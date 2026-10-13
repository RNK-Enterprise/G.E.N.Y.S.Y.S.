//! C.O.M.M.A.N.D. session gate for GENYSYS.
//!
//! Doctrine (2026-09-06): GENYSYS is the browser and the door; C.O.M.M.A.N.D.
//! (via the Resolute Authentication Core) is the master key. A production
//! GENYSYS opens only on a C.O.M.M.A.N.D. session. Local shortcodes are a
//! DEV/bootstrap affordance and are refused in production builds.
//!
//! The handshake URL is not hard-coded. Configure it with `COMMAND_URL` or
//! `RESOLUTE_URL`. If a production build starts without one, GENYSYS holds in
//! fail-closed: no session can be created until the key app is wired or
//! `GENYSYS_TEST_MODE=1` marks an explicitly non-production bench run.

use crate::attestation;
use crate::AppState;
use serde_json::json;
use tauri::State;

/// C.O.M.M.A.N.D. / Resolute handshake base URL (empty = unconfigured).
pub fn resolve_command_url() -> String {
    std::env::var("COMMAND_URL")
        .or_else(|_| std::env::var("RESOLUTE_URL"))
        .unwrap_or_default()
}

/// Production gate mode: release builds unless GENYSYS_TEST_MODE=1 is set
/// explicitly (bench runs; still refuses to fake a handshake).
pub fn is_command_mode() -> bool {
    if std::env::var("GENYSYS_TEST_MODE").ok().as_deref() == Some("1") {
        return false;
    }
    !cfg!(debug_assertions)
}

/// Called once at startup. A misconfigured production build prints a loud
/// fail-closed HOLD; it never invents a fallback identity provider.
pub fn enforce_command_gate() {
    if is_command_mode() && resolve_command_url().trim().is_empty() {
        eprintln!(
            "[GENYSYS GATE] FAIL-CLOSED HOLD: production build without COMMAND_URL/RESOLUTE_URL.\n\
             GENYSYS will not create sessions (shortcodes disabled in production).\n\
             Point COMMAND_URL at the C.O.M.M.A.N.D. / Resolute Authentication Core,\n\
             or run bench tests with GENYSYS_TEST_MODE=1."
        );
    }
}

#[tauri::command]
pub fn cmd_gate_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let url = state.command_url.lock().map_err(|e| e.to_string())?.clone();
    let configured = !url.trim().is_empty();
    Ok(json!({
        "mode": if is_command_mode() { "command" } else { "dev" },
        "configured": configured,
        // `hold` = production gate present but the key app is not wired yet.
        "hold": is_command_mode() && !configured,
        "resolver": "Resolute Authentication Core (C.O.M.M.A.N.D. master key)",
    }))
}

/// Headers GENYSYS trusts from RNK product surfaces. The session token is issued
/// by the native shell; products refuse requests without these headers.
/// Header names are documented in docs/GENYSYS_ATTESTATION.md (not secret).
#[tauri::command]
pub fn get_policy_headers(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let session = state.session.lock().map_err(|e| e.to_string())?;
    let token = session.session_token.as_deref().unwrap_or("");
    if token.is_empty() {
        return Ok(json!({ "headers": {} }));
    }
    Ok(json!({
        "headers": {
            "X-GENYSYS-Client": "1",
            "X-GENYSYS-Session": token,
            "X-GENYSYS-Tier": session.access_tier,
        },
    }))
}

/// Bootstrap page the products' JS fetches to obtain a cookie-carrying
/// attestation for iframe-originated requests (custom headers cannot be set
/// cross-origin from an iframe; cookies can).
#[tauri::command]
pub fn attestation_bootstrap(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let session = state.session.lock().map_err(|e| e.to_string())?;
    let token = session.session_token.as_deref().unwrap_or("");
    if token.is_empty() {
        return Err(attestation::REASON_MISSING.into());
    }
    Ok(attestation::bootstrap_json(token, &session.access_tier, 8 * 3600))
}
