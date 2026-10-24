//! GENYSYS misc commands — health probes, access-request status, DNS lookup.
//! Extracted from main.rs (LOC bar).

use crate::AppState;
use serde_json::json;
use tauri::State;

#[tauri::command]
pub async fn check_policy_health(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let policy_url = state.policy_url.lock().map_err(|e| e.to_string())?.clone();
    let policy_key = state.policy_key.lock().map_err(|e| e.to_string())?.clone();

    let local_ok = true; // embedded policy always present
    if policy_url.trim().is_empty() {
        return Ok(json!({
            "connected": true,
            "mode": "local",
            "localPolicy": local_ok,
            "policyUrl": "",
        }));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(format!("{}/health", policy_url.trim_end_matches('/')));
    if let Some(ref key) = policy_key {
        req = req.header("X-API-Key", key);
    }

    match req.send().await {
        Ok(resp) => Ok(json!({
            "connected": resp.status().is_success(),
            "mode": "remote",
            "localPolicy": local_ok,
            "status": resp.status().as_u16(),
            "policyUrl": policy_url,
        })),
        Err(e) => Ok(json!({
            "connected": false,
            "mode": "local-fallback",
            "localPolicy": local_ok,
            "error": e.to_string(),
            "policyUrl": policy_url,
        })),
    }
}
#[tauri::command]
pub async fn check_atlas_health(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    check_policy_health(state).await
}

#[tauri::command]
pub async fn request_site_access(
    _domain: String,
    _reason: Option<String>,
    _state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    Err("access_request_authority_not_configured".into())
}

#[tauri::command]
pub fn turbo_dns_lookup(host: String) -> Result<serde_json::Value, String> {
    use std::net::ToSocketAddrs;
    let addrs: Vec<String> = format!("{}:0", host)
        .to_socket_addrs()
        .map_err(|e| e.to_string())?
        .map(|a| a.ip().to_string())
        .collect();
    Ok(json!({ "host": host, "addrs": addrs, }))
}
