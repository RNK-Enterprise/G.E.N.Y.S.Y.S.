//! VEIL tab window commands — the shell's IPC surface for window-mode tabs,
//! plus the title/URL watcher that keeps the tab bar in sync with real
//! WebviewWindows (remote pages have no IPC channel, so the Rust side polls
//! and emits events instead).

use crate::tab_windows::{self, TabWindows};
use crate::AppState;
use serde_json::json;
use tauri::{AppHandle, Manager};

/// Interval for the title/URL watcher (ms).
#[allow(dead_code)] // documented contract for the frontend timer
const WATCH_INTERVAL_MS: u64 = 400;

/// Shell → Rust: the content rect for a tab changed (resize/layout).
#[tauri::command]
pub fn tab_window_sync_rect(
    tab_id: u32,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    app: AppHandle,
) -> Result<(), String> {
    tab_windows::store_rect(&app, tab_id, tab_windows::TabRect { x, y, width, height })
}

/// Shell → Rust: switch the visible tab window.
#[tauri::command]
pub fn tab_window_activate(tab_id: u32, app: AppHandle) -> Result<(), String> {
    tab_windows::show_only(&app, tab_id);
    Ok(())
}

/// Shell → Rust: hide every tab window (main minimized / section view).
#[tauri::command]
pub fn tab_window_hide_all(app: AppHandle) -> Result<(), String> {
    tab_windows::hide_all(&app);
    Ok(())
}

/// Shell → Rust: main window moved — shift children by the delta.
#[tauri::command]
pub fn tab_window_sync_moved(app: AppHandle) -> Result<(), String> {
    tab_windows::sync_main_moved(&app);
    Ok(())
}

/// Shell → Rust: run a bounded navigation action in a tab window's history.
/// Only whitelisted JS is evaluated — never shell-supplied script text.
#[tauri::command]
pub fn tab_window_history(tab_id: u32, action: String, app: AppHandle) -> Result<(), String> {
    let window = app
        .get_window(&TabWindows::label(tab_id))
        .ok_or_else(|| format!("tab window {} not found", tab_id))?;
    let js = match action.as_str() {
        "back" => Some("history.back()"),
        "forward" => Some("history.forward()"),
        "reload" => Some("location.reload()"),
        _ => None,
    }
    .ok_or_else(|| "unknown_history_action".to_string())?;
    window.eval(js).map_err(|e| e.to_string())
}

/// Shell → Rust: load an internal (app-origin) page in a tab window. External
/// URLs are refused — they must go through navigate_tab's policy gate.
#[tauri::command]
pub fn tab_window_internal_load(tab_id: u32, path: String, app: AppHandle) -> Result<(), String> {
    let url = if path == "veil://newtab" {
        tab_windows::newtab_url()
    } else {
        format!("{}{}", tab_windows::app_origin(), path)
    };
    if !tab_windows::is_app_origin(&url) {
        return Err("internal_load_refused_off_app_origin".into());
    }
    let window = app
        .get_window(&TabWindows::label(tab_id))
        .ok_or_else(|| format!("tab window {} not found", tab_id))?;
    window
        .eval(&format!("window.location.href = {:?};", url))
        .map_err(|e| e.to_string())
}

/// Diagnostics: which tab windows exist and what the main window sees.
#[tauri::command]
pub fn tab_window_status(app: AppHandle) -> Result<serde_json::Value, String> {
    let tw = app.state::<TabWindows>();
    let map = tw.windows.lock().map_err(|e| e.to_string())?.clone();
    let state = app.state::<AppState>();
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?.clone();
    Ok(json!({
        "windows": map.iter().map(|(id, meta)| json!({
            "tabId": id,
            "label": TabWindows::label(*id),
            "exists": app.get_window(&TabWindows::label(*id)).is_some(),
            "privileged": meta.privileged,
        })).collect::<Vec<_>>(),
        "tabs": tabs.iter().map(|t| json!({
            "id": t.id, "url": t.url, "title": t.title, "context": t.context,
        })).collect::<Vec<_>>(),
    }))
}

/// Spawn the background watcher that mirrors child-window titles/URLs into
/// the shell (`veil:tab-meta` events) and removes bookkeeping for windows
/// that died outside our control. Started once from setup.
pub fn spawn_meta_watcher(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(WATCH_INTERVAL_MS)).await;
            let Some(tw) = app.try_state::<TabWindows>() else { continue };
            let snapshot: Vec<(u32, bool)> = match tw.windows.lock() {
                Ok(map) => map.iter().map(|(k, v)| (*k, v.privileged)).collect(),
                Err(_) => continue,
            };
            for (id, privileged) in snapshot {
                let Some(window) = app.get_window(&TabWindows::label(id)) else {
                    // Window died outside our control → prune bookkeeping.
                    if let Ok(mut map) = tw.windows.lock() {
                        map.remove(&id);
                    }
                    continue;
                };
                // Active tabs only: hidden windows don't need title syncs and
                // WebKitGTK title reads are not free.
                if !window.is_visible().unwrap_or(false) {
                    continue;
                }
                let url = window.url().to_string();
                if url.starts_with("data:") {
                    continue; // injected internal page; shell already knows
                }
                let title = window.title().unwrap_or_default();
                let _ = window.emit(
                    "veil:tab-meta",
                    json!({ "tabId": id, "url": url, "title": title, "privileged": privileged }),
                );
            }
        }
    });
}
