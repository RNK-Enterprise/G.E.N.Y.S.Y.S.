//! Local shortcode auth for standalone Axis.
//! Mother Lisa / biosig / FIDO remain stubs until that product ships.
//!
//! 2026-09-06 doctrine: production auth = C.O.M.M.A.N.D. / Resolute session.
//! Shortcodes are DEV/bootstrap only and are refused in production builds.

use crate::{AppState, Session};
use serde_json::json;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};

#[derive(Clone)]
pub struct AccessEntry {
    pub tier: String,
    pub agent_id: String,
}

/// Parse AXIS_ACCESS_CODES="code:tier:agentId,code2:tier:agentId"
/// Defaults enable standalone bootstrap (documented in README / AXIS.md).
pub fn load_access_map() -> HashMap<String, AccessEntry> {
    let raw = std::env::var("AXIS_ACCESS_CODES").unwrap_or_else(|_| {
        "axis-odinn:full:creator,axis-agent:agent:agent".into()
    });
    let mut map = HashMap::new();
    for part in raw.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        let bits: Vec<&str> = part.split(':').collect();
        if bits.len() >= 3 {
            map.insert(
                bits[0].to_string(),
                AccessEntry {
                    tier: bits[1].to_string(),
                    agent_id: bits[2].to_string(),
                },
            );
        } else if bits.len() == 2 {
            map.insert(
                bits[0].to_string(),
                AccessEntry {
                    tier: bits[1].to_string(),
                    agent_id: "local".into(),
                },
            );
        }
    }
    map
}

fn new_session_token() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("axis-{}-{}", std::process::id(), nanos)
}

#[tauri::command]
pub fn auth_resolve_code(code: String, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let trimmed = code.trim().to_string();
    if trimmed.is_empty() {
        return Err("Access code required".into());
    }

    // Mother Lisa / biosig handshake stub — never succeed
    if trimmed == "__lisa_handshake__"
        || trimmed == "__mother_lisa__"
        || trimmed == "__biosig__"
        || trimmed == "__fido__"
    {
        return Err("Mother Lisa / biosig not wired yet — use an access code".into());
    }

    // Production gate: shortcodes are DEV/bootstrap only. Production Axis
    // opens on a C.O.M.M.A.N.D. / Resolute session or holds fail-closed.
    if crate::command_gate::is_command_mode() {
        return Err(
            "Shortcode auth disabled in production — Axis opens via C.O.M.M.A.N.D. / Resolute".into(),
        );
    }

    let map = state.access_codes.lock().map_err(|e| e.to_string())?;
    let entry = map
        .get(&trimmed)
        .ok_or_else(|| "Invalid access code".to_string())?;

    let token = new_session_token();
    {
        let mut session = state.session.lock().map_err(|e| e.to_string())?;
        *session = Session {
            access_tier: entry.tier.clone(),
            user_id: Some(entry.agent_id.clone()),
            session_token: Some(token.clone()),
            shortcode: Some(trimmed.clone()),
            device_verified: false,
        };
    }

    Ok(json!({
        "token": token,
        "tier": entry.tier,
        "agentId": entry.agent_id,
        "source": "local",
    }))
}

/// Mirror a verified C.O.M.M.A.N.D./Resolute session into the Axis policy
/// engine. Called by command_session after B1 says ok:true. Never called with
/// fabricated evidence — the grant was judged by B1.
pub fn apply_command_session(state: &State<'_, AppState>, tier: String, owner_id: Option<String>, token: String) {
    if let Ok(mut session) = state.session.lock() {
        *session = Session {
            access_tier: tier,
            user_id: owner_id,
            session_token: Some(token),
            shortcode: None,
            device_verified: true,
        };
    }
}

/// Internal: clear the Axis session (heartbeat drop / explicit end).
pub fn auth_clear_session(state: &State<'_, AppState>) {
    if let Ok(mut session) = state.session.lock() {
        *session = Session::default();
    }
}

#[tauri::command]
pub fn auth_logout(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    *state.session.lock().map_err(|e| e.to_string())? = Session::default();
    // Fail-closed: no session → no loadable tab content.
    crate::tab_windows::lock_all(&app);
    Ok(())
}

#[tauri::command]
pub fn auth_session_info(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let s = state.session.lock().map_err(|e| e.to_string())?;
    Ok(json!({
        "accessTier": s.access_tier,
        "shortcode": s.shortcode,
        "deviceVerified": s.device_verified,
        "authenticated": s.session_token.is_some(),
        "userId": s.user_id,
    }))
}
