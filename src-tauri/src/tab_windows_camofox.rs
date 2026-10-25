//! Camofox-backed single-tab surface using the service's live noVNC display.

use crate::camofox_client::{CamofoxClient, CamofoxTabHandle};
use crate::camofox_client_navigate::CamofoxNavigatePolicy;
use crate::camofox_policy_bridge;
use crate::tab_windows::{
    self, classify_tab_navigation, locked_url, newtab_url, tabwin_log, window_allowed,
    TabWindowMeta, TabWindows,
};
use crate::{AppState, Session};
use tauri::window::WindowBuilder;
use tauri::{AppHandle, Manager, Runtime, WindowUrl};

/// Navigate one GENYSYS logical tab through one Camofox remote page.
pub async fn navigate<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
    url: &str,
    privileged: bool,
    session: &Session,
) -> Result<String, String> {
    if privileged {
        return Err("camofox_attestation_bridge_unavailable".into());
    }
    if url == "genysys://newtab" {
        close(app, tab_id).await?;
        ensure_window(app, tab_id, &newtab_url(), false, None)?;
        return Ok(url.to_string());
    }
    let user_id = session
        .user_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "camofox_session_identity_missing".to_string())?;
    let client = CamofoxClient::from_environment()?;
    client.health().await?;
    let vnc = client.vnc_status().await?;
    let existing = existing_handle(app, tab_id)?;
    if existing.is_none() && has_other_camofox_tab(app, tab_id)? {
        return Err("camofox_visible_surface_supports_one_tab".into());
    }
    let session_key = existing
        .as_ref()
        .map(|handle| handle.session_key.clone())
        .unwrap_or_else(|| format!("genysys-tab-{tab_id}"));
    let (remote_tab_id, is_new) = match existing {
        Some(handle) => (handle.remote_tab_id, false),
        None => (client.create_tab(user_id, &session_key).await?.tab_id, true),
    };
    let bridge = camofox_policy_bridge::ensure_bridge(app)?;
    let navigate_policy = CamofoxNavigatePolicy {
        callback_url: format!("{}/camofox/policy/check", bridge.origin),
        token: bridge.token.clone(),
        tab_id,
    };
    let navigated = match client
        .navigate(
            &remote_tab_id,
            user_id,
            &session_key,
            url,
            Some(&navigate_policy),
        )
        .await
    {
        Ok(value) => value,
        Err(error) => {
            if is_new {
                let _ = client.close(&remote_tab_id, user_id).await;
            }
            return Err(error);
        }
    };
    let final_url = navigated.url;
    let policy = tab_windows::classify_tab_navigation(&final_url, session);
    if !window_allowed(&policy) {
        let _ = client.close(&remote_tab_id, user_id).await;
        remove_handle(app, tab_id)?;
        return Err(format!("camofox_redirect_refused:{}", policy.reason));
    }
    if !navigated.hops.is_empty() {
        tabwin_log(&format!(
            "camofox tab-{tab_id} accepted {} hop(s); final={}",
            navigated.hops.len(),
            final_url
        ));
    }
    set_vnc_origin(app, vnc.novnc_port)?;
    set_handle(
        app,
        tab_id,
        CamofoxTabHandle {
            user_id: user_id.to_string(),
            session_key,
            remote_tab_id,
            current_url: final_url.clone(),
            vnc_port: vnc.novnc_port,
        },
    )?;
    ensure_window(
        app,
        tab_id,
        &tab_windows::camofox_surface_url(vnc.novnc_port),
        false,
        Some(final_url.clone()),
    )?;
    Ok(final_url)
}

/// Run a Camofox history action and keep the logical tab URL synchronized.
pub async fn history<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
    action: &str,
    session: &Session,
) -> Result<String, String> {
    let handle =
        existing_handle(app, tab_id)?.ok_or_else(|| "camofox_tab_not_found".to_string())?;
    let client = CamofoxClient::from_environment()?;
    let url = client
        .history(&handle.remote_tab_id, &handle.user_id, action)
        .await?;
    let policy = tab_windows::classify_tab_navigation(&url, session);
    if !window_allowed(&policy) || policy.request_privileged {
        close(app, tab_id).await?;
        let reason = if policy.request_privileged {
            "camofox_attestation_bridge_unavailable"
        } else {
            &policy.reason
        };
        return Err(format!("camofox_history_refused:{reason}"));
    }
    let mut updated = handle;
    updated.current_url = url.clone();
    set_handle(app, tab_id, updated)?;
    Ok(url)
}

/// Close the remote Camofox page and its one visible GENYSYS surface.
pub async fn close<R: Runtime>(app: &AppHandle<R>, tab_id: u32) -> Result<(), String> {
    let handle = remove_handle(app, tab_id)?;
    let had_handle = handle.is_some();
    let remote_result = match handle {
        Some(handle) => close_remote(handle).await,
        None => Ok(()),
    };
    if had_handle {
        clear_vnc_origin(app);
    }
    close_window(app, tab_id);
    remote_result
}

/// Lock the visible surface immediately and close remote pages asynchronously.
pub fn lock_all<R: Runtime>(app: &AppHandle<R>) {
    let handles = match app.state::<TabWindows>().camofox_tabs.lock() {
        Ok(mut map) => map.drain().map(|(_, handle)| handle).collect::<Vec<_>>(),
        Err(_) => Vec::new(),
    };
    for handle in handles {
        schedule_remote_close(handle);
    }
    clear_vnc_origin(app);
    let ids = match app.state::<TabWindows>().windows.lock() {
        Ok(map) => map.keys().copied().collect::<Vec<_>>(),
        Err(_) => Vec::new(),
    };
    for id in ids {
        if let Some(window) = app.get_window(&TabWindows::label(id)) {
            let _ = window.eval(&format!("window.location.href = {:?};", locked_url()));
        }
    }
    if let Ok(mut map) = app.state::<TabWindows>().windows.lock() {
        for meta in map.values_mut() {
            meta.privileged = false;
        }
    }
}

fn ensure_window<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
    target: &str,
    privileged: bool,
    title_url: Option<String>,
) -> Result<(), String> {
    if let Some(window) = app.get_window(&TabWindows::label(tab_id)) {
        window
            .eval(&format!("window.location.href = {:?};", target))
            .map_err(|error| error.to_string())?;
        if let Some(title_url) = title_url {
            let _ = window.set_title(&format!("Camofox - {title_url}"));
        }
        set_window_meta(app, tab_id, privileged)?;
        return Ok(());
    }
    let parsed =
        url::Url::parse(target).map_err(|error| format!("bad camofox surface: {error}"))?;
    let nav_app = app.clone();
    let builder = WindowBuilder::new(app, TabWindows::label(tab_id), WindowUrl::External(parsed))
        .title("GENYSYS Camofox Tab")
        .decorations(false)
        .resizable(true)
        .skip_taskbar(true)
        .focused(false)
        .visible(false)
        .initialization_script(&init_script(tab_id))
        .on_navigation(move |nav| {
            if tab_windows::is_app_origin(nav.as_str())
                || tab_windows::camofox_vnc_allowed(&nav_app, nav.as_str())
            {
                return true;
            }
            let session = nav_app
                .try_state::<AppState>()
                .map(|state| {
                    state
                        .session
                        .lock()
                        .map(|value| value.clone())
                        .unwrap_or_default()
                })
                .unwrap_or_default();
            window_allowed(&classify_tab_navigation(nav.as_str(), &session))
        });
    let window = builder
        .build()
        .map_err(|error| format!("camofox surface build failed: {error}"))?;
    crate::tab_windows_webkit::apply_rect(app, &window, &tab_windows::DEFAULT_RECT);
    let _ = window.set_always_on_top(true);
    let ev_app = app.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            if let Ok(mut map) = ev_app.state::<TabWindows>().windows.lock() {
                map.remove(&tab_id);
            }
            if let Ok(mut map) = ev_app.state::<TabWindows>().camofox_tabs.lock() {
                if let Some(handle) = map.remove(&tab_id) {
                    schedule_remote_close(handle);
                }
            }
            tabwin_log(&format!("destroyed camofox surface tab-{tab_id}"));
        }
    });
    set_window_meta(app, tab_id, privileged)?;
    if let Some(title_url) = title_url {
        let _ = window.set_title(&format!("Camofox - {title_url}"));
    }
    window.show().map_err(|error| error.to_string())?;
    Ok(())
}

fn set_window_meta<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
    privileged: bool,
) -> Result<(), String> {
    let backend = crate::tab_backend::TabBackendKind::Camofox;
    app.state::<TabWindows>()
        .windows
        .lock()
        .map_err(|error| error.to_string())?
        .insert(
            tab_id,
            TabWindowMeta {
                privileged,
                backend,
            },
        );
    Ok(())
}

fn close_window<R: Runtime>(app: &AppHandle<R>, tab_id: u32) {
    if let Some(window) = app.get_window(&TabWindows::label(tab_id)) {
        let _ = window.close();
    }
    if let Ok(mut map) = app.state::<TabWindows>().windows.lock() {
        map.remove(&tab_id);
    }
    if let Ok(mut map) = app.state::<TabWindows>().rects.lock() {
        map.remove(&tab_id);
    }
}

fn existing_handle<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
) -> Result<Option<CamofoxTabHandle>, String> {
    app.state::<TabWindows>()
        .camofox_tabs
        .lock()
        .map_err(|error| error.to_string())
        .map(|map| map.get(&tab_id).cloned())
}

fn has_other_camofox_tab<R: Runtime>(app: &AppHandle<R>, tab_id: u32) -> Result<bool, String> {
    app.state::<TabWindows>()
        .camofox_tabs
        .lock()
        .map_err(|error| error.to_string())
        .map(|map| map.keys().any(|id| *id != tab_id))
}

fn set_handle<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
    handle: CamofoxTabHandle,
) -> Result<(), String> {
    app.state::<TabWindows>()
        .camofox_tabs
        .lock()
        .map_err(|error| error.to_string())?
        .insert(tab_id, handle);
    Ok(())
}

fn remove_handle<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
) -> Result<Option<CamofoxTabHandle>, String> {
    app.state::<TabWindows>()
        .camofox_tabs
        .lock()
        .map_err(|error| error.to_string())
        .map(|mut map| map.remove(&tab_id))
}

fn set_vnc_origin<R: Runtime>(app: &AppHandle<R>, port: u16) -> Result<(), String> {
    app.state::<TabWindows>()
        .camofox_vnc_origin
        .lock()
        .map_err(|error| error.to_string())?
        .replace(tab_windows::camofox_vnc_origin(port));
    Ok(())
}

fn clear_vnc_origin<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(mut origin) = app.state::<TabWindows>().camofox_vnc_origin.lock() {
        *origin = None;
    }
}

async fn close_remote(handle: CamofoxTabHandle) -> Result<(), String> {
    let client = CamofoxClient::from_environment()?;
    client.close(&handle.remote_tab_id, &handle.user_id).await
}

pub(crate) fn schedule_remote_close(handle: CamofoxTabHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(error) = close_remote(handle).await {
            eprintln!("[genysys:camofox] remote close refused: {error}");
        }
    });
}

fn init_script(tab_id: u32) -> String {
    format!(
        "window.__GENYSYS_TAB__={};window.__GENYSYS_CAMOFOX__=true;",
        tab_id
    )
}
