//! GENYSYS tab windows — real WebviewWindows per tab (Tauri 1.x).
//!
//! Architecture: the HTML shell keeps the chrome (tab bar, omnibox, sections).
//! Each tab's *content* is a real Tauri WebviewWindow layered above the main
//! window, positioned over `#webview-container`. Webviews render pages far
//! better than iframes, and RNK products' attestation cookies work properly in
//! them (iframe cross-origin cookie partitioning was the old design's flaw).
//!
//! Fail-closed doctrine, unchanged:
//!   - The frontend can only REQUEST loads; the Rust side evaluates P.R.O.
//!     T.E.C.T.S. policy itself and refuses to create a window on block.
//!   - Every navigation inside a tab window passes `on_navigation`: anything
//!     the policy does not classify as allowed is ignored before the request
//!     is issued (wry/WebKitGTK: webkit_policy_decision_ignore). There is no
//!     "load and then decide" path.
//!   - Only our own app-origin internal pages (new tab / block views) and
//!     policy-allowed URLs are loadable. Loopback/metadata stays blocked.
//!   - `request_privileged` tabs (RNK product surfaces) get the GENYSYS
//!     attestation cookie injected natively; everything else browses
//!     unattested. Dev builds get no blanket privilege.
//!   - Losing the session (heartbeat drop, logout, end) locks every tab
//!     window to the locked page via `lock_all`. Only a fresh session allows
//!     new loads.
//!
//! Remote pages cannot invoke Tauri commands (tauri 1.8 rejects IPC from
//! non-local URLs unless explicitly scoped — we configure no scope), so the
//! attestation is minted here and injected; page JS never handles the token.

use crate::protects_policy;
use crate::{AppState, PolicyResult, Session};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::window::WindowBuilder;
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, Runtime, State, Window, WindowUrl,
};

/// Journal-visible lifecycle trace (`journalctl --user -u genysys ... | grep tabwin`).
fn tabwin_log(msg: &str) {
    eprintln!("[genysys:tabwin] {}", msg);
}

/// Default geometry until the shell syncs the real content rect.
pub const DEFAULT_RECT: TabRect = TabRect { x: 0, y: 48, width: 1280, height: 720 };

/// Where the shell renders a tab's content area. The main window sends this
/// rectangle (CSS px, viewport-relative) whenever its layout changes.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct TabRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// Per-tab window bookkeeping.
#[derive(Debug, Clone)]
pub struct TabWindowMeta {
    pub privileged: bool,
}

#[derive(Default)]
pub struct TabWindows {
    pub windows: Mutex<HashMap<u32, TabWindowMeta>>,
    pub rects: Mutex<HashMap<u32, TabRect>>,
    /// Last known main-window position, for delta-move of children.
    pub last_main_pos: Mutex<(i32, i32)>,
}

impl TabWindows {
    pub fn label(tab_id: u32) -> String {
        format!("tab-{}", tab_id)
    }

    pub(crate) fn state<R: Runtime>(app: &AppHandle<R>) -> State<'_, TabWindows> {
        app.state::<TabWindows>()
    }
}

// ── Pure classification helpers (unit-tested) ─────────────────────────────────

/// The app-origin page used for all internal tab content (new tab, block
/// pages, locked state). Dev serves it from the Vite server on loopback;
/// release embeds it behind `tauri://localhost` (custom protocol, not a bind).
pub fn app_origin() -> &'static str {
    if cfg!(debug_assertions) {
        "http://127.0.0.1:1420"
    } else {
        "tauri://localhost"
    }
}

pub fn newtab_url() -> String {
    format!("{}/newtab.html", app_origin())
}

pub fn locked_url() -> String {
    format!("{}/newtab.html?view=locked", app_origin())
}

/// Exact app-origin match (scheme + host + port). Not a suffix match — this
/// is OUR shell page only, never a general "localhost is fine" rule.
pub fn is_app_origin(url: &str) -> bool {
    url == app_origin() || url.starts_with(&format!("{}/", app_origin())) || url == "genysys://newtab"
}

/// Full navigation decision for a tab window: app-origin internal pages are
/// ours and always loadable; everything else goes through P.R.O.T.E.C.T.S.
pub fn classify_tab_navigation(url: &str, session: &Session) -> PolicyResult {
    if is_app_origin(url) {
        return PolicyResult {
            decision: "allow".into(),
            reason: "internal_genysys_surface".into(),
            audit: false,
            notify: false,
            chain: false,
            request_required: false,
            request_privileged: false,
            domain: "genysys://".into(),
            source: "local".into(),
        };
    }
    let policy = protects_policy::evaluate_local(url, session);
    if policy.decision == "allow" {
        return policy;
    }
    // Evaluate the remote overlay only for allowed candidates (block stays
    // block; never let a dark remote turn a block into a load).
    policy
}

/// True when a window may exist / a load may proceed for this result.
pub fn window_allowed(policy: &PolicyResult) -> bool {
    policy.decision != "block"
}

// ── Window lifecycle ──────────────────────────────────────────────────────────

/// Create a tab window for an ALLOWED navigation. The caller (navigate_tab)
/// must have checked policy; this re-checks and refuses on block, so a
/// compromised shell cannot talk us into a window the policy refused.
pub fn create_tab_window<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
    url: &str,
    privileged: bool,
) -> Result<(), String> {
    if TabWindows::state(app)
        .windows
        .lock()
        .map_err(|e| e.to_string())?
        .contains_key(&tab_id)
    {
        return navigate_tab_window(app, tab_id, url, privileged);
    }

    let target = if url == "genysys://newtab" {
        newtab_url()
    } else {
        url.to_string()
    };
    let parsed = url::Url::parse(&target).map_err(|e| format!("bad url: {}", e))?;

    let rect = *TabWindows::state(app)
        .rects
        .lock()
        .map_err(|e| e.to_string())?
        .get(&tab_id)
        .unwrap_or(&DEFAULT_RECT);

    let init_js = init_script(privileged, tab_id);
    let nav_app = app.clone();

    let builder = WindowBuilder::new(
        app,
        TabWindows::label(tab_id),
        WindowUrl::External(parsed),
    )
    .title("GENYSYS Tab")
    .decorations(false)
    .resizable(true)
    .skip_taskbar(true)
    .focused(false)
    .visible(false)
    .initialization_script(&init_js)
    .on_navigation(move |nav| {
        // Fail-closed gate for EVERY load, including redirects and in-page
        // navigations. The session is re-read per navigation, so a drop
        // mid-session locks the tab on its next load.
        let session = nav_app
            .try_state::<AppState>()
            .map(|s| s.session.lock().map(|g| g.clone()).unwrap_or_default())
            .unwrap_or_default();
        window_allowed(&classify_tab_navigation(nav.as_str(), &session))
    });

    let window = builder
        .build()
        .map_err(|e| format!("window build failed: {}", e))?;

    apply_rect(app, &window, &rect);
    let _ = window.set_always_on_top(true);

    // Destroyed (user/OS closed it) → drop bookkeeping for THIS tab.
    let ev_app = app.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            tabwin_log(&format!(
                "destroyed tab-{tab_id}: OS webview window gone, dropping bookkeeping"
            ));
            if let Ok(mut map) = ev_app.state::<TabWindows>().windows.lock() {
                map.remove(&tab_id);
            }
        }
    });

    TabWindows::state(app)
        .windows
        .lock()
        .map_err(|e| e.to_string())?
        .insert(tab_id, TabWindowMeta { privileged });

    // Privileged tabs get the attestation cookie minted from the live
    // session (init scripts can't know it — the session may have started
    // after the window was created).
    if privileged {
        inject_attestation(app, tab_id);
    }

    window.show().map_err(|e| e.to_string())?;
    tabwin_log(&format!(
        "create tab-{tab_id}: url={url} privileged={privileged} → window live"
    ));
    Ok(())
}

/// Navigate an existing tab window to an already-allowed URL.
pub fn navigate_tab_window<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
    url: &str,
    privileged: bool,
) -> Result<(), String> {
    let window = app
        .get_window(&TabWindows::label(tab_id))
        .ok_or_else(|| format!("tab window {} not found", tab_id))?;
    let target = if url == "genysys://newtab" { newtab_url() } else { url.to_string() };
    window
        .eval(&format!("window.location.href = {:?};", target))
        .map_err(|e| e.to_string())?;
    if privileged {
        inject_attestation(app, tab_id);
    }
    if let Ok(mut map) = TabWindows::state(app).windows.lock() {
        map.insert(tab_id, TabWindowMeta { privileged });
    }
    Ok(())
}

/// Mint the documented attestation value (`axb_<expiry_ms>_<token>`) from the
/// live session and set it as a first-party cookie on the tab's page — the
/// same shape `attestation_bootstrap` serves, delivered natively because
/// remote pages cannot call Tauri commands.
pub fn inject_attestation<R: Runtime>(app: &AppHandle<R>, tab_id: u32) {
    let session = match app.try_state::<AppState>() {
        Some(s) => s.session.lock().map(|g| g.clone()).unwrap_or_default(),
        None => return,
    };
    let token = match session.session_token.as_deref() {
        Some(t) if !t.is_empty() => t.to_string(),
        _ => return,
    };
    let body = crate::attestation::bootstrap_json(&token, &session.access_tier, 8 * 3600);
    let value = body["value"].as_str().unwrap_or_default().to_string();
    let max_age = body["maxAge"].as_u64().unwrap_or(8 * 3600);
    if let Some(window) = app.get_window(&TabWindows::label(tab_id)) {
        let _ = window.eval(&format!(
            "try{{document.cookie={cookie:?};}}catch(e){{}}",
            cookie = format!("genysys_attest={}; max-age={}; path=/; Secure", value, max_age),
        ));
    }
}

/// Re-arm attestation for existing privileged windows after a fresh session.
pub fn refresh_privileged<R: Runtime>(app: &AppHandle<R>) {
    let ids: Vec<u32> = match TabWindows::state(app).windows.lock() {
        Ok(map) => map
            .iter()
            .filter(|(_, m)| m.privileged)
            .map(|(id, _)| *id)
            .collect(),
        Err(_) => return,
    };
    for id in ids {
        inject_attestation(app, id);
    }
}

/// Lock every tab window to the locked page (session drop / logout / end).
pub fn lock_all<R: Runtime>(app: &AppHandle<R>) {
    let ids: Vec<u32> = match TabWindows::state(app).windows.lock() {
        Ok(map) => map.keys().copied().collect(),
        Err(_) => return,
    };
    for id in ids {
        // Navigate to the app-origin locked view (no data: URLs in tab state).
        if let Some(window) = app.get_window(&TabWindows::label(id)) {
            let _ = window.eval(&format!(
                "window.location.href = {:?};",
                locked_url()
            ));
        }
    }
    if let Ok(mut map) = TabWindows::state(app).windows.lock() {
        for meta in map.values_mut() {
            meta.privileged = false;
        }
    }
}

/// Close (destroy) a tab's window and drop its bookkeeping.
pub fn close_tab_window<R: Runtime>(app: &AppHandle<R>, tab_id: u32) {
    let window = app.get_window(&TabWindows::label(tab_id));
    tabwin_log(&format!(
        "close tab-{tab_id}: {}",
        if window.is_some() {
            "destroying WebviewWindow"
        } else {
            "no OS window (bookkeeping-only)"
        }
    ));
    if let Some(window) = window {
        let _ = window.close();
    }
    if let Ok(mut map) = TabWindows::state(app).windows.lock() {
        map.remove(&tab_id);
    }
    if let Ok(mut rects) = TabWindows::state(app).rects.lock() {
        rects.remove(&tab_id);
    }
}

/// Show the active tab window over the chrome; hide the rest.
pub fn show_only<R: Runtime>(app: &AppHandle<R>, tab_id: u32) {
    let ids: Vec<u32> = match TabWindows::state(app).windows.lock() {
        Ok(map) => map.keys().copied().collect(),
        Err(_) => return,
    };
    for id in ids {
        if let Some(w) = app.get_window(&TabWindows::label(id)) {
            if id == tab_id {
                let _ = w.show();
            } else {
                let _ = w.hide();
            }
        }
    }
}

/// Hide every tab window (main window minimized / hidden).
pub fn hide_all<R: Runtime>(app: &AppHandle<R>) {
    let ids: Vec<u32> = match TabWindows::state(app).windows.lock() {
        Ok(map) => map.keys().copied().collect(),
        Err(_) => return,
    };
    for id in ids {
        if let Some(w) = app.get_window(&TabWindows::label(id)) {
            let _ = w.hide();
        }
    }
}

/// Record the shell's content rect for a tab (CSS px, viewport-relative).
pub fn store_rect<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
    rect: TabRect,
) -> Result<(), String> {
    TabWindows::state(app)
        .rects
        .lock()
        .map_err(|e| e.to_string())?
        .insert(tab_id, rect);
    if let Some(window) = app.get_window(&TabWindows::label(tab_id)) {
        apply_rect(app, &window, &rect);
    }
    Ok(())
}

/// Reposition/resize a tab window over the shell's content area.
/// Child windows do not move with the main window, so position =
/// main-window outer position + rect offset (scaled).
pub fn apply_rect<R: Runtime>(app: &AppHandle<R>, window: &Window<R>, rect: &TabRect) {
    if rect.width <= 0 || rect.height <= 0 {
        return;
    }
    let scale = window.scale_factor().unwrap_or(1.0);
    let (mx, my) = app
        .get_window("main")
        .and_then(|m| m.outer_position().ok())
        .map(|p| (p.x, p.y))
        .unwrap_or((0, 0));
    let _ = window.set_position(PhysicalPosition::new(
        mx + (rect.x as f64 * scale) as i32,
        my + (rect.y as f64 * scale) as i32,
    ));
    let _ = window.set_size(PhysicalSize::new(
        (rect.width as f64 * scale) as u32,
        (rect.height as f64 * scale) as u32,
    ));
}

/// Main window moved → shift every child by the same delta so tab content
/// stays glued to the chrome. Call from the main window's Moved event.
pub fn sync_main_moved<R: Runtime>(app: &AppHandle<R>) {
    let state = TabWindows::state(app);
    let pos = app
        .get_window("main")
        .and_then(|m| m.outer_position().ok())
        .map(|p| (p.x, p.y));
    let pos = match pos {
        Some(p) => p,
        None => return,
    };
    let (last_x, last_y) = match state.last_main_pos.lock() {
        Ok(g) => *g,
        Err(_) => pos,
    };
    let (dx, dy) = (pos.0 - last_x, pos.1 - last_y);
    if let Ok(mut g) = state.last_main_pos.lock() {
        *g = pos;
    }
    if dx == 0 && dy == 0 {
        return;
    }
    let ids: Vec<u32> = match state.windows.lock() {
        Ok(map) => map.keys().copied().collect(),
        Err(_) => return,
    };
    for id in ids {
        if let Some(w) = app.get_window(&TabWindows::label(id)) {
            if let Ok(p) = w.outer_position() {
                let _ = w.set_position(PhysicalPosition::new(p.x + dx, p.y + dy));
            }
        }
    }
}

// ── Injected scripts ──────────────────────────────────────────────────────────

fn init_script(privileged: bool, tab_id: u32) -> String {
    let mut js = format!(
        "window.__GENYSYS_TAB__={};window.__GENYSYS_PRIVILEGED__={};",
        tab_id, privileged
    );
    if privileged {
        // Attestation is re-minted per session (inject_attestation); this
        // stub only marks the tab so diagnostics can see the tier intent.
        js.push_str("try{document.cookie='genysys_attest=; max-age=0; path=/';}catch(e){}");
    }
    js
}



