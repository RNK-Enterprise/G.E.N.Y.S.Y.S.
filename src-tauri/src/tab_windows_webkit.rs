//! WebKit/Tauri implementation of the GENYSYS tab content surface.

use crate::tab_windows::{
    classify_tab_navigation, locked_url, newtab_url, tabwin_log, window_allowed, TabRect,
    TabWindowMeta, TabWindows, DEFAULT_RECT,
};
use crate::AppState;
use tauri::window::WindowBuilder;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Runtime, Window, WindowUrl};

/// Create a tab window for an allowed navigation after the backend gate.
pub fn create_tab_window<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
    url: &str,
    privileged: bool,
) -> Result<(), String> {
    let backend = TabWindows::backend(app)?;
    if !backend.has_native_surface() {
        return Err(backend.unavailable_reason().to_string());
    }
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

    let builder = WindowBuilder::new(app, TabWindows::label(tab_id), WindowUrl::External(parsed))
        .title("GENYSYS Tab")
        .decorations(false)
        .resizable(true)
        .skip_taskbar(true)
        .focused(false)
        .visible(false)
        .initialization_script(&init_js)
        .on_navigation(move |nav| {
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
        .insert(
            tab_id,
            TabWindowMeta {
                privileged,
                backend,
            },
        );
    if privileged {
        inject_attestation(app, tab_id);
    }
    window.show().map_err(|e| e.to_string())?;
    tabwin_log(&format!(
        "create tab-{tab_id}: url={url} privileged={privileged} → window live"
    ));
    Ok(())
}

/// Navigate an existing WebKit tab window to an already-allowed URL.
pub fn navigate_tab_window<R: Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
    url: &str,
    privileged: bool,
) -> Result<(), String> {
    let backend = TabWindows::backend(app)?;
    if !backend.has_native_surface() {
        return Err(backend.unavailable_reason().to_string());
    }
    let window = app
        .get_window(&TabWindows::label(tab_id))
        .ok_or_else(|| format!("tab window {} not found", tab_id))?;
    let target = if url == "genysys://newtab" {
        newtab_url()
    } else {
        url.to_string()
    };
    window
        .eval(&format!("window.location.href = {:?};", target))
        .map_err(|e| e.to_string())?;
    if privileged {
        inject_attestation(app, tab_id);
    }
    if let Ok(mut map) = TabWindows::state(app).windows.lock() {
        map.insert(
            tab_id,
            TabWindowMeta {
                privileged,
                backend,
            },
        );
    }
    Ok(())
}

/// Mint and inject the documented first-party attestation cookie.
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
            cookie = format!(
                "genysys_attest={}; max-age={}; path=/; Secure",
                value, max_age
            ),
        ));
    }
}

/// Re-arm attestation for existing privileged WebKit windows.
pub fn refresh_privileged<R: Runtime>(app: &AppHandle<R>) {
    let ids: Vec<u32> = match TabWindows::state(app).windows.lock() {
        Ok(map) => map
            .iter()
            .filter(|(_, meta)| meta.privileged)
            .map(|(id, _)| *id)
            .collect(),
        Err(_) => return,
    };
    for id in ids {
        inject_attestation(app, id);
    }
}

/// Lock every WebKit tab window to the locked page.
pub fn lock_all<R: Runtime>(app: &AppHandle<R>) {
    let ids: Vec<u32> = match TabWindows::state(app).windows.lock() {
        Ok(map) => map.keys().copied().collect(),
        Err(_) => return,
    };
    for id in ids {
        if let Some(window) = app.get_window(&TabWindows::label(id)) {
            let _ = window.eval(&format!("window.location.href = {:?};", locked_url()));
        }
    }
    if let Ok(mut map) = TabWindows::state(app).windows.lock() {
        for meta in map.values_mut() {
            meta.privileged = false;
        }
    }
}

/// Close a WebKit tab window and remove its geometry/bookkeeping.
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

/// Show one WebKit tab window and hide the others.
pub fn show_only<R: Runtime>(app: &AppHandle<R>, tab_id: u32) {
    let ids: Vec<u32> = match TabWindows::state(app).windows.lock() {
        Ok(map) => map.keys().copied().collect(),
        Err(_) => return,
    };
    for id in ids {
        if let Some(window) = app.get_window(&TabWindows::label(id)) {
            if id == tab_id {
                let _ = window.show();
            } else {
                let _ = window.hide();
            }
        }
    }
}

/// Hide every WebKit tab window when the shell leaves the browser section.
pub fn hide_all<R: Runtime>(app: &AppHandle<R>) {
    let ids: Vec<u32> = match TabWindows::state(app).windows.lock() {
        Ok(map) => map.keys().copied().collect(),
        Err(_) => return,
    };
    for id in ids {
        if let Some(window) = app.get_window(&TabWindows::label(id)) {
            let _ = window.hide();
        }
    }
}

/// Record and apply the shell content rectangle for a WebKit tab.
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

/// Reposition and resize a WebKit child window over the shell content area.
pub fn apply_rect<R: Runtime>(app: &AppHandle<R>, window: &Window<R>, rect: &TabRect) {
    if rect.width <= 0 || rect.height <= 0 {
        return;
    }
    let scale = window.scale_factor().unwrap_or(1.0);
    let (mx, my) = app
        .get_window("main")
        .and_then(|main| main.outer_position().ok())
        .map(|position| (position.x, position.y))
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

/// Shift WebKit child windows with the main window after a move.
pub fn sync_main_moved<R: Runtime>(app: &AppHandle<R>) {
    let state = TabWindows::state(app);
    let Some(pos) = app
        .get_window("main")
        .and_then(|main| main.outer_position().ok())
        .map(|position| (position.x, position.y))
    else {
        return;
    };
    let (last_x, last_y) = match state.last_main_pos.lock() {
        Ok(guard) => *guard,
        Err(_) => pos,
    };
    let (dx, dy) = (pos.0 - last_x, pos.1 - last_y);
    if let Ok(mut guard) = state.last_main_pos.lock() {
        *guard = pos;
    }
    if dx == 0 && dy == 0 {
        return;
    }
    let ids: Vec<u32> = match state.windows.lock() {
        Ok(map) => map.keys().copied().collect(),
        Err(_) => return,
    };
    for id in ids {
        if let Some(window) = app.get_window(&TabWindows::label(id)) {
            if let Ok(position) = window.outer_position() {
                let _ =
                    window.set_position(PhysicalPosition::new(position.x + dx, position.y + dy));
            }
        }
    }
}

fn init_script(privileged: bool, tab_id: u32) -> String {
    let mut js = format!(
        "window.__GENYSYS_TAB__={};window.__GENYSYS_PRIVILEGED__={};",
        tab_id, privileged
    );
    if privileged {
        js.push_str("try{document.cookie='genysys_attest=; max-age=0; path=/';}catch(e){}");
    }
    js
}
