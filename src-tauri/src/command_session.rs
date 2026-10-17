//! C.O.M.M.A.N.D. / Resolute session exchange + heartbeat (client side).
//!
//! Contract mirrored from the Resolute Authentication Core organ
//! (`P.R.O.T.E.C.T.S./Resolute Authentication Core/src/b1-auth.js`) and the
//! P.R.O.T.E.C.T.S. wire path
//! (`C.O.M.M.A.N.D. authority docs/PROTECTS_WIRE_PATH_2026-09-04.md`):
//!
//! - `POST {base}/api/v1/owner/session/start`  — begin exchange; B1 returns
//!   `{ sessionId, ok }` and, when live, per-layer challenges.
//! - `POST {base}/api/v1/owner/session/verify` — carry the four-layer authority
//!   handshake evidence gathered by C.O.M.M.A.N.D. (the owner app). GENYSYS never
//!   fabricates evidence: booleans carry zero authority on B1 and GENYSYS does
//!   not try. GENYSYS submits the C.O.M.M.A.N.D.-minted grant and B1 judges it.
//! - `POST {base}/api/v1/owner/session/end`    — explicit end.
//! - `POST {base}/gateway/v1/heartbeat`        — beat; B1 owns 15/10/5
//!   warning tiers. On the client we mirror drop detection: 3 consecutive
//!   failed beats → session dropped → GENYSYS re-locks (fail closed). Only a
//!   fresh exchange re-arms.
//!
//! Dormant by design: until COMMAND_URL/RESOLUTE_URL is configured, exchange
//! returns `dark` and the gate stays in HOLD. This module never invents a
//! fallback identity provider.

use crate::AppState;
use serde_json::json;
use tauri::{AppHandle, State};

#[allow(dead_code)] // exported for the frontend timer contract
const HEARTBEAT_INTERVAL_MS: u64 = 5_000;
const MAX_MISSED_BEATS: u32 = 3;

#[derive(Debug, Clone, PartialEq)]
pub enum GatePhase {
    /// No COMMAND_URL configured — production HOLD.
    Dark,
    /// URL set, no session yet.
    Holding,
    /// Exchange in progress (challenges out).
    Exchanging,
    /// Verified session; heartbeat live.
    Open,
}

pub struct SessionExchange {
    pub phase: GatePhase,
    pub session_id: Option<String>,
    pub owner_id: Option<String>,
    pub tier: Option<String>,
    pub token: Option<String>,
    pub token_expires_at_ms: Option<u64>,
    pub missed_beats: u32,
    pub last_error: Option<String>,
}

impl Default for SessionExchange {
    fn default() -> Self {
        SessionExchange {
            phase: GatePhase::Dark,
            session_id: None,
            owner_id: None,
            tier: None,
            token: None,
            token_expires_at_ms: None,
            missed_beats: 0,
            last_error: None,
        }
    }
}

pub struct CommandClient {
    pub state: SessionExchange,
}

impl CommandClient {
    pub fn new(url: Option<String>) -> Self {
        let mut c = CommandClient { state: SessionExchange::default() };
        c.state.phase = match url {
            Some(u) if !u.trim().is_empty() => GatePhase::Holding,
            _ => GatePhase::Dark,
        };
        c
    }

    fn base(url: &str) -> String {
        url.trim_end_matches('/').to_string()
    }

    /// Step 1+2 of the wire path: session/start then session/verify.
    /// `grant` is the C.O.M.M.A.N.D.-minted evidence bundle (produced by the
    /// authority app handshake). GENYSYS forwards it verbatim; it never fakes it.
    pub async fn exchange(&mut self, base_url: &str, grant: &serde_json::Value) -> Result<serde_json::Value, String> {
        if base_url.trim().is_empty() {
            self.state.phase = GatePhase::Dark;
            return Err("command_dark".into());
        }
        self.state.phase = GatePhase::Exchanging;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .build()
            .map_err(|e| e.to_string())?;

        let start = client
            .post(format!("{}/api/v1/owner/session/start", Self::base(base_url)))
            .json(&json!({ "client": "genysys", "tier": "request" }))
            .send()
            .await
            .map_err(|_| "command_unreachable_fail_closed".to_string())?;
        if !start.status().is_success() {
            self.state.phase = GatePhase::Holding;
            self.state.last_error = Some(format!("session/start HTTP {}", start.status()));
            return Err("command_exchange_denied".into());
        }
        let start_body: serde_json::Value = start.json().await.map_err(|e| e.to_string())?;
        let session_id = start_body["sessionId"].as_str().unwrap_or("").to_string();
        if session_id.is_empty() {
            self.state.phase = GatePhase::Holding;
            return Err("command_exchange_invalid".into());
        }

        let verify = client
            .post(format!("{}/api/v1/owner/session/verify", Self::base(base_url)))
            .json(&json!({ "sessionId": session_id, "grant": grant, "client": "genysys" }))
            .send()
            .await
            .map_err(|_| "command_unreachable_fail_closed".to_string())?;
        if !verify.status().is_success() {
            self.state.phase = GatePhase::Holding;
            self.state.last_error = Some(format!("session/verify HTTP {}", verify.status()));
            return Err("command_exchange_denied".into());
        }
        let body: serde_json::Value = verify.json().await.map_err(|e| e.to_string())?;
        // B1 denies with ok:false (e.g. incomplete-handshake). Fail closed.
        if body["ok"].as_bool() != Some(true) {
            self.state.phase = GatePhase::Holding;
            self.state.last_error = Some(
                body["reason"].as_str().unwrap_or("incomplete-handshake").to_string(),
            );
            return Err("command_exchange_denied".into());
        }

        let token = body["token"].as_str().unwrap_or("").to_string();
        if token.is_empty() {
            self.state.phase = GatePhase::Holding;
            return Err("command_exchange_invalid".into());
        }
        self.state.session_id = Some(session_id);
        self.state.owner_id = body["ownerId"].as_str().map(|s| s.to_string());
        self.state.tier = body["tier"].as_str().map(|s| s.to_string()).or(Some("full".into()));
        self.state.token = Some(token);
        self.state.token_expires_at_ms =
            body["expiresAt"].as_u64().or(Some(now_ms() + 8 * 3600 * 1000));
        self.state.missed_beats = 0;
        self.state.last_error = None;
        self.state.phase = GatePhase::Open;
        Ok(json!({
            "ok": true,
            "sessionId": self.state.session_id,
            "ownerId": self.state.owner_id,
            "tier": self.state.tier,
        }))
    }

    /// One heartbeat beat. Mirrors B1's 15/10/5 ownership client-side: GENYSYS
    /// tracks consecutive failures and drops the session after MAX_MISSED_BEATS.
    pub async fn beat(&mut self, base_url: &str) -> Result<serde_json::Value, String> {
        if self.state.phase != GatePhase::Open {
            return Err("command_not_open".into());
        }
        let session_id = self.state.session_id.clone().unwrap_or_default();
        let token = self.state.token.clone().unwrap_or_default();
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(4))
            .build()
            .map_err(|e| e.to_string())?;
        match client
            .post(format!("{}/gateway/v1/heartbeat", Self::base(base_url)))
            .header("Authorization", format!("Bearer {}", token))
            .json(&json!({ "sessionId": session_id, "channel": "genysys", "ts": now_ms() }))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                self.state.missed_beats = 0;
                Ok(json!({ "ok": true, "missedBeats": 0 }))
            }
            _ => {
                self.state.missed_beats += 1;
                let missed = self.state.missed_beats;
                if missed >= MAX_MISSED_BEATS {
                    // Link drop → drop session → GENYSYS re-locks (fail closed).
                    self.reset("heartbeat_link_drop");
                    return Err("command_heartbeat_link_drop".into());
                }
                Ok(json!({ "ok": false, "missedBeats": missed, "max": MAX_MISSED_BEATS }))
            }
        }
    }

    pub fn reset(&mut self, reason: &str) {
        self.state = SessionExchange {
            phase: if reason == "command_dark" { GatePhase::Dark } else { GatePhase::Holding },
            last_error: Some(reason.to_string()),
            ..SessionExchange::default()
        };
    }

    pub fn is_open(&self) -> bool {
        self.state.phase == GatePhase::Open
            && self.state.token.is_some()
            && self
                .state
                .token_expires_at_ms
                .map(|e| now_ms() < e)
                .unwrap_or(false)
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Live status for the gate UI.
#[tauri::command]
pub async fn command_session_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let exchange = state.command_session.lock().await;
    Ok(json!({
        "phase": match exchange.state.phase {
            GatePhase::Dark => "dark",
            GatePhase::Holding => "holding",
            GatePhase::Exchanging => "exchanging",
            GatePhase::Open => "open",
        },
        "sessionId": exchange.state.session_id,
        "ownerId": exchange.state.owner_id,
        "missedBeats": exchange.state.missed_beats,
        "lastError": exchange.state.last_error,
    }))
}

/// Exchange a C.O.M.M.A.N.D. grant for an GENYSYS session.
/// Refuses in dev mode when no URL is configured (still fail-closed there —
/// shortcode bootstrap remains the dev path).
#[tauri::command]
pub async fn command_exchange(
    grant: serde_json::Value,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<serde_json::Value, String> {
    let base_url = state.command_url.lock().map_err(|e| e.to_string())?.clone();
    if base_url.trim().is_empty() {
        return Err("command_dark".into());
    }
    {
        let mut exchange = state.command_session.lock().await;
        let result = exchange.exchange(&base_url, &grant).await;
        if result.is_err() {
            return result;
        }
    }
    // Mirror the verified session into the GENYSYS session/policy engine.
    let exchange = state.command_session.lock().await;
    let tier = exchange.state.tier.clone().unwrap_or_else(|| "full".into());
    let owner_id = exchange.state.owner_id.clone();
    let token = exchange.state.token.clone().unwrap_or_default();
    crate::auth::apply_command_session(&state, tier.clone(), owner_id.clone(), token.clone());
    drop(exchange);
    // Re-arm attestation cookies on privileged tabs opened pre-session.
    crate::tab_windows::refresh_privileged(&app);
    Ok(json!({
        "ok": true,
        "source": "command",
        "token": token,
        "tier": tier,
        "agentId": owner_id,
    }))
}

/// Explicit end (owner action) — also drops the GENYSYS session.
#[tauri::command]
pub async fn command_end(state: State<'_, AppState>, app: AppHandle) -> Result<serde_json::Value, String> {
    let base_url = state.command_url.lock().map_err(|e| e.to_string())?.clone();
    let mut exchange = state.command_session.lock().await;
    if exchange.is_open() && !base_url.trim().is_empty() {
        let session_id = exchange.state.session_id.clone().unwrap_or_default();
        let token = exchange.state.token.clone().unwrap_or_default();
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(4))
            .build()
            .map_err(|e| e.to_string())?;
        let _ = client
            .post(format!("{}/api/v1/owner/session/end", base_url.trim_end_matches('/')))
            .header("Authorization", format!("Bearer {}", token))
            .json(&json!({ "sessionId": session_id }))
            .send()
            .await; // best-effort; local drop happens regardless
    }
    exchange.reset("command_end");
    crate::auth::auth_clear_session(&state);
    crate::tab_windows::lock_all(&app);
    Ok(json!({ "ok": true }))
}

/// One client heartbeat tick; frontend calls this on a 5s timer.
#[tauri::command]
pub async fn command_heartbeat(state: State<'_, AppState>, app: AppHandle) -> Result<serde_json::Value, String> {
    let base_url = state.command_url.lock().map_err(|e| e.to_string())?.clone();
    let mut exchange = state.command_session.lock().await;
    if !exchange.is_open() {
        return Ok(json!({ "ok": false, "phase": "not-open" }));
    }
    let result = exchange.beat(&base_url).await;
    if result.is_err() {
        // Link drop → re-lock the GENYSYS session AND every tab window.
        crate::auth::auth_clear_session(&state);
        crate::tab_windows::lock_all(&app);
        return result;
    }
    result
}

#[allow(dead_code)] // frontend timer contract
pub const HEARTBEAT_PERIOD_MS: u64 = HEARTBEAT_INTERVAL_MS;
