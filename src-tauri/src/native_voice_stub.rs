use serde::Serialize;
use tauri::{ipc::Response, State};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct NativeVoiceState {
    #[allow(dead_code)]
    session: Mutex<()>,
}

#[derive(Serialize)]
pub struct NativeVoiceParticipant {
    identity: String,
    name: String,
    is_local: bool,
    is_screen_sharing: bool,
    is_camera_enabled: bool,
}

#[derive(Serialize)]
pub struct NativeVoiceStatus {
    connected: bool,
    muted: bool,
    deafened: bool,
    participants: Vec<NativeVoiceParticipant>,
    screen_sharing: bool,
    camera_enabled: bool,
}

fn unsupported() -> String {
    "Native voice backend is only available on Linux. This platform uses the WebRTC browser backend."
        .to_string()
}

fn disconnected_status() -> NativeVoiceStatus {
    NativeVoiceStatus {
        connected: false,
        muted: false,
        deafened: false,
        participants: Vec::new(),
        screen_sharing: false,
        camera_enabled: false,
    }
}

#[tauri::command]
pub async fn native_voice_connect(
    _url: String,
    _token: String,
    _state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    Err(unsupported())
}

#[tauri::command]
pub async fn native_voice_status(
    _state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    Ok(disconnected_status())
}

#[tauri::command]
pub async fn native_voice_set_muted(
    _muted: bool,
    _state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    Err(unsupported())
}

#[tauri::command]
pub async fn native_voice_set_deafened(
    _deafened: bool,
    _state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    Err(unsupported())
}

#[tauri::command]
pub async fn native_voice_start_camera(
    _state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    Err(unsupported())
}

#[tauri::command]
pub async fn native_voice_stop_camera(
    _state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    Err(unsupported())
}

#[tauri::command]
pub async fn native_voice_start_screen_share(
    _height: u32,
    _fps: u32,
    _state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    Err(unsupported())
}

#[tauri::command]
pub async fn native_voice_stop_screen_share(
    _state: State<'_, NativeVoiceState>,
) -> Result<NativeVoiceStatus, String> {
    Err(unsupported())
}

#[tauri::command]
pub async fn native_voice_screen_frame(
    _identity: String,
    _source: String,
    _state: State<'_, NativeVoiceState>,
) -> Result<Response, String> {
    Err(unsupported())
}

#[tauri::command]
pub async fn native_voice_disconnect(_state: State<'_, NativeVoiceState>) -> Result<(), String> {
    Ok(())
}
