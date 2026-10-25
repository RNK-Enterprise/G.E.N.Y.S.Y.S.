//! GENYSYS logical tab-surface registry (Tauri 1.x).
//!
//! Architecture: the HTML shell keeps the chrome (tab bar, omnibox, sections).
//! Each tab has one selected content backend and one lifecycle. The current
//! WebKit surface is implemented in `tab_windows_webkit`; future backends must
//! use this same logical tab rather than create a second visible tab.
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
//! Backend-specific navigation and surface work stays outside this registry.

use crate::camofox_client::CamofoxTabHandle;
use crate::protects_policy;
use crate::tab_backend::TabBackendKind;
use crate::{PolicyResult, Session};
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime, State};

/// Journal-visible lifecycle trace (`journalctl --user -u genysys ... | grep tabwin`).
pub(crate) fn tabwin_log(msg: &str) {
    eprintln!("[genysys:tabwin] {}", msg);
}

/// Default geometry until the shell syncs the real content rect.
pub const DEFAULT_RECT: TabRect = TabRect {
    x: 0,
    y: 48,
    width: 1280,
    height: 720,
};

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
    pub backend: TabBackendKind,
}

pub struct TabWindows {
    pub backend: Mutex<Result<TabBackendKind, String>>,
    pub windows: Mutex<HashMap<u32, TabWindowMeta>>,
    pub camofox_tabs: Mutex<HashMap<u32, CamofoxTabHandle>>,
    pub camofox_vnc_origin: Mutex<Option<String>>,
    /// Logical tabs whose Camofox context already holds genysys_attest.
    pub camofox_attested_tabs: Mutex<HashSet<u32>>,
    pub rects: Mutex<HashMap<u32, TabRect>>,
    /// Last known main-window position, for delta-move of children.
    pub last_main_pos: Mutex<(i32, i32)>,
}

impl Default for TabWindows {
    fn default() -> Self {
        Self {
            backend: Mutex::new(TabBackendKind::from_environment()),
            windows: Mutex::new(HashMap::new()),
            camofox_tabs: Mutex::new(HashMap::new()),
            camofox_vnc_origin: Mutex::new(None),
            camofox_attested_tabs: Mutex::new(HashSet::new()),
            rects: Mutex::new(HashMap::new()),
            last_main_pos: Mutex::new((0, 0)),
        }
    }
}

impl TabWindows {
    pub fn label(tab_id: u32) -> String {
        format!("tab-{}", tab_id)
    }

    pub(crate) fn state<R: Runtime>(app: &AppHandle<R>) -> State<'_, TabWindows> {
        app.state::<TabWindows>()
    }

    pub(crate) fn backend<R: Runtime>(app: &AppHandle<R>) -> Result<TabBackendKind, String> {
        TabWindows::state(app)
            .backend
            .lock()
            .map_err(|e| e.to_string())?
            .clone()
    }
}

pub(crate) fn backend<R: Runtime>(app: &AppHandle<R>) -> Result<TabBackendKind, String> {
    TabWindows::backend(app)
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

pub fn camofox_surface_url(vnc_port: u16) -> String {
    format!("{}/camofox.html?vncPort={vnc_port}", app_origin())
}

pub(crate) fn camofox_vnc_origin(vnc_port: u16) -> String {
    format!("http://127.0.0.1:{vnc_port}")
}

pub(crate) fn camofox_vnc_allowed<R: Runtime>(app: &AppHandle<R>, url: &str) -> bool {
    let expected = match TabWindows::state(app).camofox_vnc_origin.lock() {
        Ok(origin) => origin.clone(),
        Err(_) => return false,
    };
    let Some(expected) = expected else {
        return false;
    };
    let Ok(parsed) = url::Url::parse(url) else {
        return false;
    };
    parsed.origin().ascii_serialization() == expected
        && matches!(parsed.path(), "/" | "/vnc.html" | "/websockify")
}

/// Exact app-origin match (scheme + host + port). Not a suffix match — this
/// is OUR shell page only, never a general "localhost is fine" rule.
pub fn is_app_origin(url: &str) -> bool {
    url == app_origin()
        || url.starts_with(&format!("{}/", app_origin()))
        || url == "genysys://newtab"
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
pub use crate::tab_windows_webkit::{
    close_tab_window, create_tab_window, hide_all, show_only, store_rect, sync_main_moved,
};

pub fn lock_all<R: Runtime>(app: &AppHandle<R>) {
    match TabWindows::backend(app) {
        Ok(TabBackendKind::Camofox) => crate::tab_windows_camofox::lock_all(app),
        Ok(TabBackendKind::Webkit) | Err(_) => crate::tab_windows_webkit::lock_all(app),
    }
}

pub fn refresh_privileged<R: Runtime>(app: &AppHandle<R>) {
    match TabWindows::backend(app) {
        Ok(TabBackendKind::Webkit) => crate::tab_windows_webkit::refresh_privileged(app),
        Ok(TabBackendKind::Camofox) => crate::tab_windows_camofox::refresh_privileged(app),
        Err(_) => {}
    }
}
