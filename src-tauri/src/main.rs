#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/**
 * RNK Axis™ — P.R.O.T.E.C.T.S.-Governed Privacy Browser (standalone)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Every navigation is cleared through embedded P.R.O.T.E.C.T.S. policy
 * (fail-closed). Remote overlay is optional. Axis stands alone.
 * Axis is RNK's ONLY client; C.O.M.M.A.N.D. (Resolute) is the master key.
 */

mod attestation;
mod auth;
mod command_gate;
mod command_session;
mod commands_health;
mod lisa_policy;
mod tab_commands;
mod tab_windows;

#[cfg(test)]
mod lisa_policy_tests;

#[cfg(test)]
mod command_session_tests;

#[cfg(test)]
mod tab_windows_tests;

use auth::{load_access_map, AccessEntry};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, Window};

const ECHONET_DOMAINS: &[&str] = &[
    "rnk-enterprise.us",
    "raven.rnk-enterprise.us",
    "echonet.rnk-enterprise.us",
    "mail.rnk-enterprise.us",
    "demo.rnk-enterprise.us",
    "app.rnk-enterprise.us",
    "localhost",
    "127.0.0.1",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TabContext {
    Privileged,
    Normal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tab {
    pub id: u32,
    pub url: String,
    pub title: String,
    pub context: TabContext,
    pub loading: bool,
    pub can_go_back: bool,
    pub can_go_fwd: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub access_tier: String,
    pub user_id: Option<String>,
    pub session_token: Option<String>,
    pub shortcode: Option<String>,
    pub device_verified: bool,
}

impl Default for Session {
    fn default() -> Self {
        Session {
            access_tier: "locked".into(),
            user_id: None,
            session_token: None,
            shortcode: None,
            device_verified: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyResult {
    pub decision: String,
    pub reason: String,
    pub audit: bool,
    pub notify: bool,
    pub chain: bool,
    pub request_required: bool,
    /// Reserve a Privileged tab (RNK product surfaces only).
    #[serde(rename = "requestPrivileged")]
    pub request_privileged: bool,
    pub domain: String,
    pub source: String,
}

pub struct AppState {
    tabs: Mutex<Vec<Tab>>,
    session: Mutex<Session>,
    next_tab_id: Mutex<u32>,
    /// Optional remote Lisa base URL (empty = local-only standalone).
    lisa_url: Mutex<String>,
    lisa_key: Mutex<Option<String>>,
    prefer_remote: Mutex<bool>,
    access_codes: Mutex<HashMap<String, AccessEntry>>,
    /// C.O.M.M.A.N.D. / Resolute handshake base URL (empty = unconfigured).
    command_url: Mutex<String>,
    /// Async-guarded because exchange/heartbeat hold it across awaits.
    command_session: tokio::sync::Mutex<command_session::CommandClient>,
}

fn resolve_lisa_url() -> String {
    std::env::var("LISA_URL")
        .or_else(|_| std::env::var("ATLAS_URL"))
        .unwrap_or_default()
}

fn extract_domain(url: &str) -> Option<String> {
    let u = if url.starts_with("http") {
        url.to_string()
    } else {
        format!("https://{}", url)
    };
    url::Url::parse(&u)
        .ok()
        .and_then(|p| p.host_str().map(|h| h.trim_start_matches("www.").to_lowercase()))
}

fn is_echonet_url(url: &str) -> bool {
    if let Some(domain) = extract_domain(url) {
        return ECHONET_DOMAINS
            .iter()
            .any(|d| domain == *d || domain.ends_with(&format!(".{}", d)));
    }
    false
}

fn determine_context(url: &str) -> TabContext {
    if is_echonet_url(url) {
        TabContext::Privileged
    } else {
        TabContext::Normal
    }
}

#[tauri::command]
async fn navigate_tab(
    tab_id: u32,
    url: String,
    state: State<'_, AppState>,
    window: Window,
    app: AppHandle,
) -> Result<PolicyResult, String> {
    let (lisa_url, lisa_key, session, prefer_remote) = {
        let au = state.lisa_url.lock().map_err(|e| e.to_string())?.clone();
        let lk = state.lisa_key.lock().map_err(|e| e.to_string())?.clone();
        let s = state.session.lock().map_err(|e| e.to_string())?.clone();
        let pr = *state.prefer_remote.lock().map_err(|e| e.to_string())?;
        (au, lk, s, pr)
    };

    let policy =
        lisa_policy::check_policy(&url, &session, &lisa_url, &lisa_key, prefer_remote).await;

    if policy.decision == "block" {
        return Ok(policy);
    }

    let context = determine_context(&url);
    {
        let mut tabs = state.tabs.lock().map_err(|e| e.to_string())?;
        if let Some(tab) = tabs.iter_mut().find(|t| t.id == tab_id) {
            tab.url = url.clone();
            tab.context = context.clone();
            tab.loading = true;
        }
    }

    // Real WebviewWindow mode: create/reuse the tab window HERE, after the
    // policy allow — the frontend never loads URLs itself.
    if let Err(e) = tab_windows::create_tab_window(&app, tab_id, &url, policy.request_privileged) {
        // Window layer unavailable → surface as a policy refusal (fail-closed
        // behavior: no window, no load).
        return Ok(lisa_policy::block_result(&format!("tab_window_refused:{}", e), &policy.domain));
    }

    let _ = window.emit(
        "axis:navigate",
        serde_json::json!({
            "tabId": tab_id,
            "url": url,
            "context": context,
            "chain": policy.chain,
            "privileged": policy.request_privileged,
        }),
    );

    Ok(policy)
}

#[tauri::command]
fn create_tab(state: State<'_, AppState>) -> Result<Tab, String> {
    let mut tabs = state.tabs.lock().map_err(|e| e.to_string())?;
    let mut next = state.next_tab_id.lock().map_err(|e| e.to_string())?;
    *next += 1;
    let id = *next;

    let tab = Tab {
        id,
        url: "axis://newtab".into(),
        title: "New Tab".into(),
        context: TabContext::Normal,
        loading: false,
        can_go_back: false,
        can_go_fwd: false,
    };
    tabs.push(tab.clone());
    Ok(tab)
}

#[tauri::command]
fn close_tab(tab_id: u32, state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    {
        let mut tabs = state.tabs.lock().map_err(|e| e.to_string())?;
        tabs.retain(|t| t.id != tab_id);
    }
    tab_windows::close_tab_window(&app, tab_id);
    Ok(())
}

#[tauri::command]
fn get_tabs(state: State<'_, AppState>) -> Result<Vec<Tab>, String> {
    Ok(state.tabs.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
fn update_tab_meta(
    tab_id: u32,
    title: Option<String>,
    loading: Option<bool>,
    can_go_back: Option<bool>,
    can_go_fwd: Option<bool>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut tabs = state.tabs.lock().map_err(|e| e.to_string())?;
    if let Some(tab) = tabs.iter_mut().find(|t| t.id == tab_id) {
        if let Some(t) = title {
            tab.title = t
        }
        if let Some(l) = loading {
            tab.loading = l
        }
        if let Some(b) = can_go_back {
            tab.can_go_back = b
        }
        if let Some(f) = can_go_fwd {
            tab.can_go_fwd = f
        }
    }
    Ok(())
}

#[tauri::command]
fn set_session(
    access_tier: String,
    user_id: Option<String>,
    session_token: Option<String>,
    shortcode: Option<String>,
    device_verified: bool,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    *session = Session {
        access_tier,
        user_id,
        session_token,
        shortcode,
        device_verified,
    };
    drop(session);
    // New session → re-arm attestation on privileged tab windows.
    tab_windows::refresh_privileged(&app);
    Ok(())
}

#[tauri::command]
fn get_session_info(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    // NOTE: get_policy_headers (command_gate.rs) is the attestation issuer;
    // RNK products refuse requests lacking X-Axis-Client / X-Axis-Session.
    let s = state.session.lock().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "accessTier": s.access_tier,
        "shortcode": s.shortcode,
        "deviceVerified": s.device_verified,
        "authenticated": s.session_token.is_some(),
        "userId": s.user_id,
    }))
}

#[tauri::command]
fn clear_session(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    *state.session.lock().map_err(|e| e.to_string())? = Session::default();
    // Fail-closed: no session → every tab window locks.
    tab_windows::lock_all(&app);
    Ok(())
}

#[tauri::command]
fn configure_lisa(
    lisa_url: String,
    lisa_key: Option<String>,
    prefer_remote: Option<bool>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    *state.lisa_url.lock().map_err(|e| e.to_string())? = lisa_url;
    *state.lisa_key.lock().map_err(|e| e.to_string())? = lisa_key;
    if let Some(p) = prefer_remote {
        *state.prefer_remote.lock().map_err(|e| e.to_string())? = p;
    }
    Ok(())
}

/// Deprecated alias for configure_lisa.
#[tauri::command]
fn configure_atlas(
    atlas_url: String,
    lisa_key: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    configure_lisa(atlas_url, lisa_key, Some(true), state)
}

#[tauri::command]
fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(unused_variables)]
fn open_devtools(window: Window) {
    // Devtools are a debug-build affordance only — never in production.
    #[cfg(debug_assertions)]
    window.open_devtools();
}

#[tauri::command]
fn window_maximize(window: Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn window_close(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

fn main() {
    let lisa_url = resolve_lisa_url();
    let prefer_remote = !lisa_url.is_empty();

    let state = AppState {
        tabs: Mutex::new(Vec::new()),
        session: Mutex::new(Session::default()),
        next_tab_id: Mutex::new(0),
        lisa_url: Mutex::new(lisa_url.clone()),
        lisa_key: Mutex::new(std::env::var("LISA_API_KEY").ok()),
        prefer_remote: Mutex::new(prefer_remote),
        access_codes: Mutex::new(load_access_map()),
        command_url: Mutex::new(command_gate::resolve_command_url()),
        command_session: tokio::sync::Mutex::new(command_session::CommandClient::new(
            command_gate::resolve_command_url().into(),
        )),
    };

    tauri::Builder::default()
        .manage(state)
        .manage(tab_windows::TabWindows::default())
        .invoke_handler(tauri::generate_handler![
            navigate_tab,
            create_tab,
            close_tab,
            get_tabs,
            update_tab_meta,
            set_session,
            get_session_info,
            clear_session,
            configure_lisa,
            configure_atlas,
            commands_health::check_lisa_health,
            commands_health::check_atlas_health,
            auth::auth_resolve_code,
            auth::auth_logout,
            auth::auth_session_info,
            command_gate::cmd_gate_status,
            command_gate::get_policy_headers,
            command_gate::attestation_bootstrap,
            command_session::command_session_status,
            command_session::command_exchange,
            command_session::command_end,
            command_session::command_heartbeat,
            commands_health::request_site_access,
            commands_health::turbo_dns_lookup,
            tab_commands::tab_window_sync_rect,
            tab_commands::tab_window_activate,
            tab_commands::tab_window_hide_all,
            tab_commands::tab_window_sync_moved,
            tab_commands::tab_window_internal_load,
            tab_commands::tab_window_history,
            tab_commands::tab_window_status,
            window_minimize,
            window_maximize,
            window_close,
            open_devtools,
        ])
        .on_window_event(move |event| {
            // Keep tab content glued to the chrome: children are separate OS
            // windows, so a main-window move shifts every child by the delta.
            if let tauri::WindowEvent::Moved(_) = event.event() {
                if event.window().label() == "main" {
                    tab_windows::sync_main_moved(&event.window().app_handle());
                }
            }
        })
        .setup(|_app| {
            println!("Axis™ v0.1.0 — P.R.O.T.E.C.T.S.-governed browser (RNK's only client)");
            let url = resolve_lisa_url();
            if url.is_empty() {
                println!("P.R.O.T.E.C.T.S. mode: embedded local policy (fail-closed)");
            } else {
                println!("P.R.O.T.E.C.T.S. mode: local + optional remote {}", url);
            }
            command_gate::enforce_command_gate();
            tab_commands::spawn_meta_watcher(_app.handle().clone());
            #[cfg(debug_assertions)]
            {
                if let Some(window) = tauri::Manager::get_window(_app, "main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running Axis");
}
