// Prevents an extra console window on Windows in release. Harmless on Linux.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK on Linux: avoid DMABUF renderer crashes (common on NVIDIA)
    // and enable media stream (camera/mic) and display capture (screen share)
    // features that are disabled by default in WebKitGTK.
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    better_vc_lib::run()
}
