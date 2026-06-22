use std::net::{IpAddr, Ipv4Addr};

use tauri::ipc::Response;

/// Downloads public R2 media through Rust while forcing IPv4. Some Linux
/// networks advertise a broken IPv6 route for r2.dev, which makes WebKit image
/// requests fail nondeterministically even though the object exists.
#[tauri::command]
pub async fn fetch_r2_media(url: String) -> Result<Response, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|_| "Invalid media URL".to_string())?;
    let allowed = parsed.scheme() == "https"
        && parsed
            .host_str()
            .is_some_and(|host| host == "r2.dev" || host.ends_with(".r2.dev"));
    if !allowed {
        return Err("Only public R2 media URLs are allowed".to_string());
    }

    let client = reqwest::Client::builder()
        .local_address(IpAddr::V4(Ipv4Addr::UNSPECIFIED))
        .build()
        .map_err(|error| format!("Media client error: {error}"))?;
    let response = client
        .get(parsed)
        .send()
        .await
        .map_err(|error| format!("Media download failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Media download failed: {error}"))?;
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Media download failed: {error}"))?;

    Ok(Response::new(bytes.to_vec()))
}
