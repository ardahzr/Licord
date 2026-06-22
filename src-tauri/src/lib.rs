// Better-VC native (Rust) backend.
//
// The data layer (Supabase, Cloudflare R2) is reached directly from the
// frontend per the project's serverless architecture, so this crate stays thin.
// It owns the native window/runtime and is where Phase 6 work lands:
// system tray, frameless window handling, and Wayland/X11 niceties.

mod media;
mod native_voice;

/// Returns the app version baked in at compile time. Smoke-test for the IPC bridge.
#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(native_voice::NativeVoiceState::default())
        .invoke_handler(tauri::generate_handler![
            app_version,
            native_voice::native_voice_connect,
            native_voice::native_voice_status,
            native_voice::native_voice_set_muted,
            native_voice::native_voice_set_deafened,
            native_voice::native_voice_disconnect,
            media::fetch_r2_media,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Better-VC");
}
