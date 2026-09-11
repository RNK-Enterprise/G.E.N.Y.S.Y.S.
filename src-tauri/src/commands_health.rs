//! Axis misc commands — health probes, Raven access requests, DNS lookup.
//! Extracted from main.rs (LOC bar).

use crate::AppState;
use serde_json::json;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn check_lisa_health(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let lisa_url = state.lisa_url.lock().map_err(|e| e.to_string())?.clone();
    let lisa_key = state.lisa_key.lock().map_err(|e| e.to_string())?.clone();

    let local_ok = true; // embedded policy always present
    if lisa_url.trim().is_empty() {
        return Ok(json!({
            "connected": true,
            "mode": "local",
            "localPolicy": local_ok,
            "lisaUrl": "",
        }));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(format!("{}/health", lisa_url.trim_end_matches('/')));
    if let Some(ref key) = lisa_key {
        req = req.header("X-API-Key", key);
    }

    match req.send().await {
        Ok(resp) => Ok(json!({
            "connected": resp.status().is_success(),
            "mode": "remote",
            "localPolicy": local_ok,
            "status": resp.status().as_u16(),
            "lisaUrl": lisa_url,
        })),
        Err(e) => Ok(json!({
            "connected": false,
            "mode": "local-fallback",
            "localPolicy": local_ok,
            "error": e.to_string(),
            "lisaUrl": lisa_url,
        })),
    }
}

#[tauri::command]
pub async fn check_atlas_health(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    check_lisa_health(state).await
}

#[tauri::command]
pub async fn request_site_access(
    domain: String,
    reason: Option<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let session = state.session.lock().map_err(|e| e.to_string())?.clone();
    if session.session_token.is_none() {
        return Err("Not authenticated".into());
    }

    let raven_url = std::env::var("RAVEN_URL").unwrap_or_else(|_| "http://localhost:3003".into());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    // Axis attests its own calls too — Raven's /api/axis/* gate refuses
    // requests without the X-Axis-Client / X-Axis-Session headers.
    let token = session.session_token.clone().unwrap_or_default();
    let resp = client
        .post(format!("{}/api/axis/access-request", raven_url))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", token))
        .header("X-Axis-Client", "1")
        .header("X-Axis-Session", &token)
        .header("X-Axis-Tier", &session.access_tier)
        .json(&json!({
            "domain": domain,
            "accessTier": session.access_tier,
            "reason": reason,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub fn turbo_dns_lookup(host: String) -> Result<serde_json::Value, String> {
    use std::net::ToSocketAddrs;
    let addrs: Vec<String> = format!("{}:0", host)
        .to_socket_addrs()
        .map_err(|e| e.to_string())?
        .map(|a| a.ip().to_string())
        .collect();
    Ok(json!({ "host": host, "addrs": addrs }))
}

/// Keep AppHandle import honest if commands change shape later.
#[allow(dead_code)]
fn _unused(_a: &AppHandle) {}
