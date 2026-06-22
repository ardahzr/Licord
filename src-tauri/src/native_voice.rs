use livekit::{
    options::TrackPublishOptions,
    prelude::{
        LocalAudioTrack, LocalTrack, LocalTrackPublication, PlatformAudio, Room, RoomOptions,
        TrackSource,
    },
};
use serde::Serialize;
use tauri::State;
use tokio::sync::Mutex;

#[derive(Default)]
pub struct NativeVoiceState {
    session: Mutex<Option<NativeVoiceSession>>,
}

struct NativeVoiceSession {
    room: Room,
    publication: LocalTrackPublication,
    // PlatformAudio owns WebRTC's Linux microphone/speaker device module.
    _audio: PlatformAudio,
    deafened: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeVoiceParticipant {
    identity: String,
    name: String,
    is_local: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeVoiceStatus {
    connected: bool,
    muted: bool,
    deafened: bool,
    participants: Vec<NativeVoiceParticipant>,
}

impl NativeVoiceStatus {
    fn disconnected() -> Self {
        Self {
            connected: false,
            muted: false,
            deafened: false,
            participants: Vec::new(),
        }
    }
}

fn status_for(session: &NativeVoiceSession) -> NativeVoiceStatus {
    // Tracks can be published after the user deafens. Re-apply the preference
    // whenever status is sampled so newly joined speakers stay silent too.
    if session.deafened {
        for participant in session.room.remote_participants().into_values() {
            for publication in participant.track_publications().into_values() {
                if publication.kind() == livekit::prelude::TrackKind::Audio {
                    publication.set_enabled(false);
                }
            }
        }
    }
    let local = session.room.local_participant();
    let mut participants = vec![NativeVoiceParticipant {
        identity: local.identity().to_string(),
        name: local.name(),
        is_local: true,
    }];

    participants.extend(
        session
            .room
            .remote_participants()
            .into_values()
            .map(|participant| NativeVoiceParticipant {
                identity: participant.identity().to_string(),
                name: participant.name(),
                is_local: false,
            }),
    );

    NativeVoiceStatus {
        connected: true,
        muted: session.publication.is_muted(),
        deafened: session.deafened,
        participants,
    }
}

#[tauri::command]
pub async fn native_voice_connect(
    url: String,
    token: String,
    state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    // Close any previous room without holding the state lock across await.
    if let Some(previous) = state.session.lock().await.take() {
        let _ = previous.room.close().await;
    }

    let audio = PlatformAudio::new().map_err(|error| format!("Audio device error: {error}"))?;
    if audio.recording_devices().next().is_none() {
        return Err("No microphone was found".to_string());
    }
    if audio.playout_devices().next().is_none() {
        return Err("No speaker/output device was found".to_string());
    }

    let (room, mut events) = Room::connect(&url, &token, RoomOptions::default())
        .await
        .map_err(|error| format!("Native LiveKit connection failed: {error}"))?;

    // The platform source captures the selected Linux microphone. PlatformAudio
    // also routes subscribed remote audio tracks to the selected speaker.
    let track = LocalAudioTrack::create_audio_track("microphone", audio.rtc_source());
    let publication = room
        .local_participant()
        .publish_track(
            LocalTrack::Audio(track),
            TrackPublishOptions {
                source: TrackSource::Microphone,
                ..Default::default()
            },
        )
        .await
        .map_err(|error| format!("Microphone publish failed: {error}"))?;

    // Room events must be drained so the SDK can keep delivering participant
    // and track changes. Status is exposed to React through a lightweight poll.
    tauri::async_runtime::spawn(async move { while events.recv().await.is_some() {} });

    let session = NativeVoiceSession {
        room,
        publication,
        _audio: audio,
        deafened: false,
    };
    let status = status_for(&session);
    *state.session.lock().await = Some(session);
    Ok(status)
}

#[tauri::command]
pub async fn native_voice_set_deafened(
    deafened: bool,
    state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    let mut session = state.session.lock().await;
    let session = session
        .as_mut()
        .ok_or_else(|| "Not connected to voice".to_string())?;
    session.deafened = deafened;
    for participant in session.room.remote_participants().into_values() {
        for publication in participant.track_publications().into_values() {
            if publication.kind() == livekit::prelude::TrackKind::Audio {
                publication.set_enabled(!deafened);
            }
        }
    }
    Ok(status_for(session))
}

#[tauri::command]
pub async fn native_voice_status(
    state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    Ok(state
        .session
        .lock()
        .await
        .as_ref()
        .map(status_for)
        .unwrap_or_else(NativeVoiceStatus::disconnected))
}

#[tauri::command]
pub async fn native_voice_set_muted(
    muted: bool,
    state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    let session = state.session.lock().await;
    let session = session
        .as_ref()
        .ok_or_else(|| "Not connected to voice".to_string())?;
    if muted {
        session.publication.mute();
    } else {
        session.publication.unmute();
    }
    Ok(status_for(session))
}

#[tauri::command]
pub async fn native_voice_disconnect(state: State<'_, NativeVoiceState>) -> Result<(), String> {
    if let Some(session) = state.session.lock().await.take() {
        session
            .room
            .close()
            .await
            .map_err(|error| format!("Voice disconnect failed: {error}"))?;
    }
    Ok(())
}
