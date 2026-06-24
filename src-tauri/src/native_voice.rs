use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};

use futures_util::StreamExt;
use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_app as gst_app;
use livekit::webrtc::{
    audio_frame::AudioFrame,
    audio_source::{native::NativeAudioSource, AudioSourceOptions, RtcAudioSource},
};
use livekit::webrtc::{
    desktop_capturer::{DesktopCaptureSourceType, DesktopCapturer, DesktopCapturerOptions},
    native::yuv_helper::argb_to_i420,
    prelude::{RtcVideoSource, VideoResolution},
    video_frame::{I420Buffer, VideoFormatType, VideoFrame, VideoRotation},
    video_source::native::NativeVideoSource,
    video_stream::native::NativeVideoStream,
};
use livekit::{
    options::TrackPublishOptions,
    prelude::{
        LocalAudioTrack, LocalTrack, LocalTrackPublication, LocalVideoTrack, PlatformAudio,
        RemoteTrack, Room, RoomEvent, RoomOptions, TrackSource,
    },
};
use serde::Serialize;
use tauri::{ipc::Response, State};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct NativeVoiceState {
    session: Mutex<Option<NativeVoiceSession>>,
}

struct NativeVoiceSession {
    room: Arc<Room>,
    publication: LocalTrackPublication,
    // PlatformAudio owns WebRTC's Linux microphone/speaker device module.
    _audio: PlatformAudio,
    _microphone_capture: NativeMicrophoneCapture,
    deafened: bool,
    screen_share: Option<NativeScreenShare>,
    camera: Option<NativeCamera>,
    remote_screen_frames: Arc<Mutex<HashMap<String, Vec<u8>>>>,
}

struct NativeMicrophoneCapture {
    stop: Arc<AtomicBool>,
}

impl Drop for NativeMicrophoneCapture {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}

struct NativeScreenShare {
    publication: LocalTrackPublication,
    stop: Arc<AtomicBool>,
}

struct NativeCamera {
    publication: LocalTrackPublication,
    stop: Arc<AtomicBool>,
}

struct CapturedDesktopFrame {
    width: u32,
    height: u32,
    stride: u32,
    data: Vec<u8>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeVoiceParticipant {
    identity: String,
    name: String,
    is_local: bool,
    is_screen_sharing: bool,
    is_camera_enabled: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeVoiceStatus {
    connected: bool,
    muted: bool,
    deafened: bool,
    participants: Vec<NativeVoiceParticipant>,
    screen_sharing: bool,
    camera_enabled: bool,
}

impl NativeVoiceStatus {
    fn disconnected() -> Self {
        Self {
            connected: false,
            muted: false,
            deafened: false,
            participants: Vec::new(),
            screen_sharing: false,
            camera_enabled: false,
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
        is_screen_sharing: session.screen_share.is_some(),
        is_camera_enabled: session.camera.is_some(),
    }];

    participants.extend(
        session
            .room
            .remote_participants()
            .into_values()
            .map(|participant| {
                let is_screen_sharing = participant
                    .track_publications()
                    .values()
                    .any(|publication| publication.source() == TrackSource::Screenshare);
                let is_camera_enabled = participant
                    .track_publications()
                    .values()
                    .any(|publication| publication.source() == TrackSource::Camera);
                NativeVoiceParticipant {
                    identity: participant.identity().to_string(),
                    name: participant.name(),
                    is_local: false,
                    is_screen_sharing,
                    is_camera_enabled,
                }
            }),
    );

    NativeVoiceStatus {
        connected: true,
        muted: session.publication.is_muted(),
        deafened: session.deafened,
        participants,
        screen_sharing: session.screen_share.is_some(),
        camera_enabled: session.camera.is_some(),
    }
}

fn push_desktop_frame(
    source: &NativeVideoSource,
    frame: &CapturedDesktopFrame,
    target_height: Option<u32>,
) {
    let mut buffer = I420Buffer::new(frame.width, frame.height);
    let (stride_y, stride_u, stride_v) = buffer.strides();
    let (data_y, data_u, data_v) = buffer.data_mut();
    argb_to_i420(
        &frame.data,
        frame.stride,
        data_y,
        stride_y,
        data_u,
        stride_u,
        data_v,
        stride_v,
        frame.width as i32,
        frame.height as i32,
    );
    if let Some(target_height) = target_height.filter(|height| *height < frame.height) {
        let target_width =
            ((frame.width as f64 * target_height as f64 / frame.height as f64) as i32).max(2) & !1;
        let scaled = buffer.scale(target_width, target_height as i32 & !1);
        source.capture_frame(&VideoFrame::new(VideoRotation::VideoRotation0, scaled));
    } else {
        source.capture_frame(&VideoFrame::new(VideoRotation::VideoRotation0, buffer));
    }
}

fn screen_resolution(frame: &CapturedDesktopFrame, target_height: u32) -> VideoResolution {
    if target_height < frame.height {
        VideoResolution {
            width: (((frame.width as f64 * target_height as f64 / frame.height as f64) as u32)
                .max(2))
                & !1,
            height: target_height & !1,
        }
    } else {
        VideoResolution {
            width: frame.width,
            height: frame.height,
        }
    }
}

fn initialize_desktop_capture() -> Result<
    (
        DesktopCapturer,
        std::sync::mpsc::Receiver<CapturedDesktopFrame>,
        CapturedDesktopFrame,
    ),
    String,
> {
    let wayland = std::env::var("WAYLAND_DISPLAY").is_ok();
    let source_type = if wayland {
        DesktopCaptureSourceType::Generic
    } else {
        DesktopCaptureSourceType::Screen
    };
    let mut options = DesktopCapturerOptions::new(source_type);
    options.set_include_cursor(true);
    let mut capturer = DesktopCapturer::new(options)
        .ok_or_else(|| "Linux screen capturer could not be created".to_string())?;
    let selected_source = if wayland {
        None
    } else {
        capturer.get_source_list().into_iter().next()
    };
    if !wayland && selected_source.is_none() {
        return Err("No screen was found to share".to_string());
    }

    let (sender, receiver) = std::sync::mpsc::sync_channel(2);
    capturer.start_capture(selected_source, move |result| {
        if let Ok(frame) = result {
            let owned = CapturedDesktopFrame {
                width: frame.width().max(0) as u32,
                height: frame.height().max(0) as u32,
                stride: frame.stride(),
                data: frame.data().to_vec(),
            };
            let _ = sender.try_send(owned);
        }
    });

    // On Wayland the first request opens the xdg-desktop-portal picker. Allow
    // enough time for the user to select a monitor/window.
    let started = std::time::Instant::now();
    let first = loop {
        capturer.capture_frame();
        match receiver.recv_timeout(Duration::from_millis(300)) {
            Ok(frame) if frame.width > 0 && frame.height > 0 => break frame,
            _ if started.elapsed() > Duration::from_secs(90) => {
                return Err("Screen selection timed out or was cancelled".to_string());
            }
            _ => {}
        }
    };
    Ok((capturer, receiver, first))
}

fn pull_camera_frame(
    sink: &gst_app::AppSink,
    timeout: gst::ClockTime,
) -> Result<CapturedDesktopFrame, String> {
    let sample = sink
        .try_pull_sample(timeout)
        .ok_or_else(|| "Camera did not produce a frame".to_string())?;
    let caps = sample
        .caps()
        .ok_or_else(|| "Camera frame has no format information".to_string())?;
    let structure = caps
        .structure(0)
        .ok_or_else(|| "Camera frame format is invalid".to_string())?;
    let width = structure
        .get::<i32>("width")
        .map_err(|_| "Camera frame width is missing".to_string())?
        .max(0) as u32;
    let height = structure
        .get::<i32>("height")
        .map_err(|_| "Camera frame height is missing".to_string())?
        .max(0) as u32;
    let buffer = sample
        .buffer()
        .ok_or_else(|| "Camera frame is empty".to_string())?;
    let map = buffer
        .map_readable()
        .map_err(|_| "Camera frame could not be read".to_string())?;
    let stride = if height > 0 {
        (map.as_slice().len() / height as usize) as u32
    } else {
        width * 4
    };
    Ok(CapturedDesktopFrame {
        width,
        height,
        stride,
        data: map.as_slice().to_vec(),
    })
}

fn start_noise_suppressed_microphone(
) -> Result<(NativeAudioSource, NativeMicrophoneCapture), String> {
    gst::init().map_err(|error| format!("GStreamer initialization failed: {error}"))?;
    let pipeline = gst::parse::launch(
        "pulsesrc buffer-time=20000 latency-time=10000 ! audioconvert ! audioresample ! audio/x-raw,format=S16LE,layout=interleaved,rate=48000,channels=1 ! appsink name=mic_sink max-buffers=4 drop=true sync=false",
    )
    .map_err(|error| format!("Noise-filtered microphone pipeline could not be created: {error}"))?
    .downcast::<gst::Pipeline>()
    .map_err(|_| "Noise-filtered microphone pipeline is invalid".to_string())?;
    let sink = pipeline
        .by_name("mic_sink")
        .ok_or_else(|| "Microphone filter output could not be created".to_string())?
        .downcast::<gst_app::AppSink>()
        .map_err(|_| "Microphone filter output is invalid".to_string())?;

    let source = NativeAudioSource::new(
        AudioSourceOptions {
            echo_cancellation: true,
            noise_suppression: true,
            auto_gain_control: true,
        },
        48_000,
        1,
        0,
    );
    pipeline
        .set_state(gst::State::Playing)
        .map_err(|error| format!("Microphone filter could not start: {error}"))?;

    let capture_source = source.clone();
    let stop = Arc::new(AtomicBool::new(false));
    let capture_stop = stop.clone();
    std::thread::spawn(move || {
        let mut denoiser = nnnoiseless::DenoiseState::new();
        let mut pending = Vec::<i16>::with_capacity(960);
        let mut filtered = [0.0_f32; nnnoiseless::DenoiseState::FRAME_SIZE];
        let mut input = [0.0_f32; nnnoiseless::DenoiseState::FRAME_SIZE];
        let mut first_frame = true;
        let mut voice_hangover = 0_u8;

        while !capture_stop.load(Ordering::Relaxed) {
            let Some(sample) = sink.try_pull_sample(gst::ClockTime::from_mseconds(100)) else {
                continue;
            };
            let Some(buffer) = sample.buffer() else {
                continue;
            };
            let Ok(map) = buffer.map_readable() else {
                continue;
            };
            pending.extend(
                map.as_slice()
                    .chunks_exact(2)
                    .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]])),
            );

            while pending.len() >= nnnoiseless::DenoiseState::FRAME_SIZE {
                for (target, sample) in input.iter_mut().zip(pending.drain(..480)) {
                    *target = sample as f32;
                }
                let voice_probability = denoiser.process_frame(&mut filtered, &input);
                if voice_probability >= 0.35 {
                    voice_hangover = 20;
                } else {
                    voice_hangover = voice_hangover.saturating_sub(1);
                }
                let quiet_background = voice_hangover == 0 && voice_probability < 0.15;
                let samples = filtered.map(|sample| {
                    let sample = if quiet_background {
                        sample * 0.08
                    } else {
                        sample
                    };
                    sample.clamp(i16::MIN as f32, i16::MAX as f32) as i16
                });
                if first_frame {
                    first_frame = false;
                    continue;
                }
                let frame = AudioFrame {
                    data: samples.as_slice().into(),
                    sample_rate: 48_000,
                    num_channels: 1,
                    samples_per_channel: 480,
                };
                if tauri::async_runtime::block_on(capture_source.capture_frame(&frame)).is_err() {
                    capture_stop.store(true, Ordering::Relaxed);
                    break;
                }
            }
        }
        let _ = pipeline.set_state(gst::State::Null);
    });

    Ok((source, NativeMicrophoneCapture { stop }))
}

fn initialize_camera_capture(
) -> Result<(gst::Pipeline, gst_app::AppSink, CapturedDesktopFrame), String> {
    gst::init().map_err(|error| format!("GStreamer initialization failed: {error}"))?;
    let device = (0..64)
        .map(|index| format!("/dev/video{index}"))
        .find(|path| std::path::Path::new(path).exists())
        .ok_or_else(|| {
            "No camera device was found (/dev/video* is missing). Load the uvcvideo driver and reconnect the camera."
                .to_string()
        })?;
    let pipeline_description = format!(
        "v4l2src device={device} ! videoconvert ! videoscale ! videorate ! video/x-raw,format=BGRA,width=1280,height=720,framerate=15/1 ! appsink name=camera_sink max-buffers=1 drop=true sync=false"
    );
    let pipeline = gst::parse::launch(&pipeline_description)
        .map_err(|error| format!("Camera pipeline could not be created: {error}"))?
        .downcast::<gst::Pipeline>()
        .map_err(|_| "Camera pipeline is invalid".to_string())?;
    let sink = pipeline
        .by_name("camera_sink")
        .ok_or_else(|| "Camera output could not be created".to_string())?
        .downcast::<gst_app::AppSink>()
        .map_err(|_| "Camera output is invalid".to_string())?;
    pipeline
        .set_state(gst::State::Playing)
        .map_err(|error| format!("Camera could not start: {error}"))?;
    let first = pull_camera_frame(&sink, gst::ClockTime::from_seconds(8)).inspect_err(|_| {
        let _ = pipeline.set_state(gst::State::Null);
    })?;
    Ok((pipeline, sink, first))
}

fn encode_video_frame_jpeg(frame: &livekit::webrtc::video_frame::BoxVideoFrame) -> Option<Vec<u8>> {
    let source_width = frame.buffer.width();
    let source_height = frame.buffer.height();
    if source_width == 0 || source_height == 0 {
        return None;
    }
    // Keep the WebKit JPEG bridge light enough for interactive screen sharing.
    // LiveKit still carries the full-resolution track to browser participants.
    let width = source_width.min(1280);
    let height = ((source_height as f64 * width as f64 / source_width as f64) as u32).max(2) & !1;
    let mut rgba = vec![0_u8; (width * height * 4) as usize];
    frame.buffer.as_ref().to_argb(
        // libyuv's ABGR fourcc is RGBA byte order on little-endian Linux.
        VideoFormatType::ABGR,
        &mut rgba,
        width * 4,
        width as i32,
        height as i32,
    );
    let mut rgb = Vec::with_capacity((width * height * 3) as usize);
    for pixel in rgba.chunks_exact(4) {
        rgb.extend_from_slice(&pixel[..3]);
    }
    let mut jpeg = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 65)
        .encode(&rgb, width, height, image::ExtendedColorType::Rgb8)
        .ok()?;
    Some(jpeg)
}

fn encode_bgra_jpeg(frame: &CapturedDesktopFrame) -> Option<Vec<u8>> {
    let width = frame.width.min(1280);
    let height = ((frame.height as f64 * width as f64 / frame.width as f64) as u32).max(1);
    let mut rgb = Vec::with_capacity((width * height * 3) as usize);
    for target_y in 0..height {
        let source_y = target_y * frame.height / height;
        for target_x in 0..width {
            let source_x = target_x * frame.width / width;
            let offset = source_y as usize * frame.stride as usize + source_x as usize * 4;
            let pixel = frame.data.get(offset..offset + 4)?;
            rgb.extend_from_slice(&[pixel[2], pixel[1], pixel[0]]);
        }
    }
    let mut jpeg = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 75)
        .encode(&rgb, width, height, image::ExtendedColorType::Rgb8)
        .ok()?;
    Some(jpeg)
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
    let recording_device = audio
        .recording_devices()
        .next()
        .ok_or_else(|| "No microphone was found".to_string())?;
    audio
        .set_recording_device(&recording_device.id)
        .map_err(|error| {
            format!(
                "Microphone '{}' could not be selected: {error}",
                recording_device.name
            )
        })?;
    let playout_device = audio
        .playout_devices()
        .next()
        .ok_or_else(|| "No speaker/output device was found".to_string())?;
    audio
        .set_playout_device(&playout_device.id)
        .map_err(|error| {
            format!(
                "Audio output '{}' could not be selected: {error}",
                playout_device.name
            )
        })?;

    let (room, mut events) = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        Room::connect(&url, &token, RoomOptions::default()),
    )
    .await
    .map_err(|_| "Native LiveKit connection timed out".to_string())?
    .map_err(|error| format!("Native LiveKit connection failed: {error}"))?;

    // Capture the selected PulseAudio microphone as 10 ms PCM frames, suppress
    // non-speech with RNNoise, then let WebRTC apply AEC/AGC as a second stage.
    // PlatformAudio remains responsible for remote speaker playout.
    let (microphone_source, microphone_capture) = start_noise_suppressed_microphone()?;
    let track = LocalAudioTrack::create_audio_track(
        "microphone",
        RtcAudioSource::Native(microphone_source),
    );
    let publication = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        room.local_participant().publish_track(
            LocalTrack::Audio(track),
            TrackPublishOptions {
                source: TrackSource::Microphone,
                ..Default::default()
            },
        ),
    )
    .await
    .map_err(|_| "Microphone publish timed out".to_string())?
    .map_err(|error| format!("Microphone publish failed: {error}"))?;

    let remote_screen_frames = Arc::new(Mutex::new(HashMap::new()));
    let event_frames = remote_screen_frames.clone();

    // Drain events and bridge subscribed native screen-share frames to JPEGs
    // that WebKit can display without browser WebRTC support.
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                RoomEvent::TrackSubscribed {
                    track: RemoteTrack::Video(track),
                    publication,
                    participant,
                } if matches!(
                    publication.source(),
                    TrackSource::Screenshare | TrackSource::Camera
                ) =>
                {
                    let identity = participant.identity().to_string();
                    let frame_key = format!(
                        "{}:{}",
                        if publication.source() == TrackSource::Screenshare {
                            "screen"
                        } else {
                            "camera"
                        },
                        identity
                    );
                    let frames = event_frames.clone();
                    tauri::async_runtime::spawn(async move {
                        let mut stream = NativeVideoStream::new(track.rtc_track());
                        let mut last_encoded = std::time::Instant::now()
                            .checked_sub(Duration::from_secs(1))
                            .unwrap_or_else(std::time::Instant::now);
                        while let Some(frame) = stream.next().await {
                            if last_encoded.elapsed() < Duration::from_millis(75) {
                                continue;
                            }
                            if let Some(jpeg) = encode_video_frame_jpeg(&frame) {
                                frames.lock().await.insert(frame_key.clone(), jpeg);
                                last_encoded = std::time::Instant::now();
                            }
                        }
                        frames.lock().await.remove(&frame_key);
                    });
                }
                RoomEvent::TrackUnsubscribed {
                    publication,
                    participant,
                    ..
                } if matches!(
                    publication.source(),
                    TrackSource::Screenshare | TrackSource::Camera
                ) =>
                {
                    let frame_key = format!(
                        "{}:{}",
                        if publication.source() == TrackSource::Screenshare {
                            "screen"
                        } else {
                            "camera"
                        },
                        participant.identity()
                    );
                    event_frames.lock().await.remove(&frame_key);
                }
                _ => {}
            }
        }
    });

    let session = NativeVoiceSession {
        room: Arc::new(room),
        publication,
        _audio: audio,
        _microphone_capture: microphone_capture,
        deafened: false,
        screen_share: None,
        camera: None,
        remote_screen_frames,
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
pub async fn native_voice_start_camera(
    state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    let (room, frames, identity) = {
        let session = state.session.lock().await;
        let session = session
            .as_ref()
            .ok_or_else(|| "Not connected to voice".to_string())?;
        if session.camera.is_some() {
            return Ok(status_for(session));
        }
        (
            session.room.clone(),
            session.remote_screen_frames.clone(),
            session.room.local_participant().identity().to_string(),
        )
    };

    let (pipeline, sink, first) = tauri::async_runtime::spawn_blocking(initialize_camera_capture)
        .await
        .map_err(|error| format!("Camera task failed: {error}"))??;
    let source = NativeVideoSource::new(
        VideoResolution {
            width: first.width,
            height: first.height,
        },
        false,
    );
    push_desktop_frame(&source, &first, None);
    let track =
        LocalVideoTrack::create_video_track("camera", RtcVideoSource::Native(source.clone()));
    let publication = tokio::time::timeout(
        Duration::from_secs(15),
        room.local_participant().publish_track(
            LocalTrack::Video(track),
            TrackPublishOptions {
                source: TrackSource::Camera,
                simulcast: false,
                ..Default::default()
            },
        ),
    )
    .await
    .map_err(|_| "Camera publish timed out".to_string())?
    .map_err(|error| format!("Camera publish failed: {error}"))?;

    let stop = Arc::new(AtomicBool::new(false));
    let capture_stop = stop.clone();
    std::thread::spawn(move || {
        let key = format!("camera:{identity}");
        let mut last_preview = std::time::Instant::now()
            .checked_sub(Duration::from_secs(1))
            .unwrap_or_else(std::time::Instant::now);
        while !capture_stop.load(Ordering::Relaxed) {
            match pull_camera_frame(&sink, gst::ClockTime::from_mseconds(250)) {
                Ok(frame) => {
                    push_desktop_frame(&source, &frame, None);
                    if last_preview.elapsed() >= Duration::from_millis(180) {
                        if let Some(jpeg) = encode_bgra_jpeg(&frame) {
                            frames.blocking_lock().insert(key.clone(), jpeg);
                            last_preview = std::time::Instant::now();
                        }
                    }
                }
                Err(_) => continue,
            }
        }
        let _ = pipeline.set_state(gst::State::Null);
        frames.blocking_lock().remove(&key);
    });

    let mut session = state.session.lock().await;
    let session = session
        .as_mut()
        .ok_or_else(|| "Voice call ended while starting camera".to_string())?;
    session.camera = Some(NativeCamera { publication, stop });
    Ok(status_for(session))
}

#[tauri::command]
pub async fn native_voice_stop_camera(
    state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    let mut session = state.session.lock().await;
    let session = session
        .as_mut()
        .ok_or_else(|| "Not connected to voice".to_string())?;
    if let Some(camera) = session.camera.take() {
        camera.stop.store(true, Ordering::Relaxed);
        session
            .room
            .local_participant()
            .unpublish_track(&camera.publication.sid())
            .await
            .map_err(|error| format!("Could not stop camera: {error}"))?;
    }
    Ok(status_for(session))
}

#[tauri::command]
pub async fn native_voice_start_screen_share(
    height: u32,
    fps: u32,
    state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    if !matches!(height, 720 | 1080 | 1440) || !matches!(fps, 15 | 30 | 60) {
        return Err("Invalid screen-share quality".to_string());
    }
    let (room, frames, identity) = {
        let session = state.session.lock().await;
        let session = session
            .as_ref()
            .ok_or_else(|| "Not connected to voice".to_string())?;
        if session.screen_share.is_some() {
            return Ok(status_for(session));
        }
        (
            session.room.clone(),
            session.remote_screen_frames.clone(),
            session.room.local_participant().identity().to_string(),
        )
    };

    let (mut capturer, receiver, first) =
        tauri::async_runtime::spawn_blocking(initialize_desktop_capture)
            .await
            .map_err(|error| format!("Screen capture task failed: {error}"))??;

    let source = NativeVideoSource::new(screen_resolution(&first, height), true);
    push_desktop_frame(&source, &first, Some(height));
    let track =
        LocalVideoTrack::create_video_track("screen-share", RtcVideoSource::Native(source.clone()));
    let publication = tokio::time::timeout(
        Duration::from_secs(15),
        room.local_participant().publish_track(
            LocalTrack::Video(track),
            TrackPublishOptions {
                source: TrackSource::Screenshare,
                simulcast: false,
                ..Default::default()
            },
        ),
    )
    .await
    .map_err(|_| "Screen-share publish timed out".to_string())?
    .map_err(|error| format!("Screen-share publish failed: {error}"))?;

    let stop = Arc::new(AtomicBool::new(false));
    let capture_stop = stop.clone();
    std::thread::spawn(move || {
        let frame_key = format!("screen:{identity}");
        let frame_interval = Duration::from_micros(1_000_000 / u64::from(fps));
        let mut last_preview = std::time::Instant::now()
            .checked_sub(Duration::from_secs(1))
            .unwrap_or_else(std::time::Instant::now);
        while !capture_stop.load(Ordering::Relaxed) {
            let frame_started = std::time::Instant::now();
            capturer.capture_frame();
            if let Ok(frame) = receiver.recv_timeout(frame_interval) {
                push_desktop_frame(&source, &frame, Some(height));
                if last_preview.elapsed() >= Duration::from_millis(80) {
                    if let Some(jpeg) = encode_bgra_jpeg(&frame) {
                        frames.blocking_lock().insert(frame_key.clone(), jpeg);
                        last_preview = std::time::Instant::now();
                    }
                }
            }
            if let Some(remaining) = frame_interval.checked_sub(frame_started.elapsed()) {
                std::thread::sleep(remaining);
            }
        }
        frames.blocking_lock().remove(&frame_key);
    });

    let mut session = state.session.lock().await;
    let session = session
        .as_mut()
        .ok_or_else(|| "Voice call ended while starting screen share".to_string())?;
    session.screen_share = Some(NativeScreenShare { publication, stop });
    Ok(status_for(session))
}

#[tauri::command]
pub async fn native_voice_stop_screen_share(
    state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    let mut session = state.session.lock().await;
    let session = session
        .as_mut()
        .ok_or_else(|| "Not connected to voice".to_string())?;
    if let Some(share) = session.screen_share.take() {
        share.stop.store(true, Ordering::Relaxed);
        let sid = share.publication.sid();
        session
            .room
            .local_participant()
            .unpublish_track(&sid)
            .await
            .map_err(|error| format!("Could not stop screen share: {error}"))?;
    }
    Ok(status_for(session))
}

#[tauri::command]
pub async fn native_voice_screen_frame(
    identity: String,
    source: String,
    state: State<'_, NativeVoiceState>,
) -> Result<Response, String> {
    let frames = {
        let session = state.session.lock().await;
        session
            .as_ref()
            .ok_or_else(|| "Not connected to voice".to_string())?
            .remote_screen_frames
            .clone()
    };
    if source != "screen" && source != "camera" {
        return Err("Invalid video source".to_string());
    }
    let frame = frames
        .lock()
        .await
        .get(&format!("{source}:{identity}"))
        .cloned()
        .ok_or_else(|| "Video frame is not ready".to_string())?;
    Ok(Response::new(frame))
}

#[tauri::command]
pub async fn native_voice_disconnect(state: State<'_, NativeVoiceState>) -> Result<(), String> {
    if let Some(mut session) = state.session.lock().await.take() {
        if let Some(share) = session.screen_share.take() {
            share.stop.store(true, Ordering::Relaxed);
        }
        if let Some(camera) = session.camera.take() {
            camera.stop.store(true, Ordering::Relaxed);
        }
        session
            .room
            .close()
            .await
            .map_err(|error| format!("Voice disconnect failed: {error}"))?;
    }
    Ok(())
}
