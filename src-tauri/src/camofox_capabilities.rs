//! Read-only structured capabilities for the Camofox-backed logical tab.

use crate::camofox_client::CamofoxClient;
use crate::tab_windows::{classify_tab_navigation, window_allowed, TabWindows};
use crate::{AppState, Session};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

/// Report service and live-surface readiness without collapsing failures into
/// a generic navigation error.
#[tauri::command]
pub async fn camofox_status() -> Result<Value, String> {
    let client = match CamofoxClient::from_environment() {
        Ok(client) => client,
        Err(error) => {
            return Ok(json!({
                "configured": true,
                "ready": false,
                "service": { "ok": false, "error": error },
                "vnc": { "ok": false, "error": "camofox_service_not_checked" },
            }));
        }
    };
    let health_error = client.health().await.err();
    let vnc = if health_error.is_none() {
        match client.vnc_status().await {
            Ok(status) => json!({ "ok": true, "status": status }),
            Err(error) => json!({ "ok": false, "error": error }),
        }
    } else {
        json!({ "ok": false, "error": "camofox_service_not_ready" })
    };
    Ok(json!({
        "configured": true,
        "ready": health_error.is_none() && vnc["ok"] == true,
        "service": {
            "ok": health_error.is_none(),
            "error": health_error,
        },
        "vnc": vnc,
    }))
}

/// Return the current Camofox accessibility snapshot for a logical tab.
#[tauri::command]
pub async fn camofox_snapshot(
    tab_id: u32,
    include_screenshot: Option<bool>,
    app: AppHandle,
) -> Result<Value, String> {
    let handle = current_handle(&app, tab_id)?;
    let client = CamofoxClient::from_environment()?;
    let result = client
        .snapshot(
            &handle.remote_tab_id,
            &handle.user_id,
            include_screenshot.unwrap_or(false),
        )
        .await?;
    let Some(url) = result.get("url").and_then(Value::as_str) else {
        let _ = crate::tab_windows_camofox::close(&app, tab_id).await;
        return Err("camofox_snapshot_url_missing".into());
    };
    enforce_reported_url(&app, tab_id, url).await?;
    Ok(result)
}

/// Return the current page screenshot as an auxiliary bounded artifact.
#[tauri::command]
pub async fn camofox_screenshot(tab_id: u32, app: AppHandle) -> Result<Value, String> {
    let handle = current_handle(&app, tab_id)?;
    let client = CamofoxClient::from_environment()?;
    let result = client
        .snapshot(&handle.remote_tab_id, &handle.user_id, true)
        .await?;
    let Some(url) = result.get("url").and_then(Value::as_str) else {
        let _ = crate::tab_windows_camofox::close(&app, tab_id).await;
        return Err("camofox_snapshot_url_missing".into());
    };
    enforce_reported_url(&app, tab_id, url).await?;
    result
        .get("screenshot")
        .cloned()
        .ok_or_else(|| "camofox_screenshot_missing".to_string())
}

/// Return bounded HTTP links from the current Camofox page.
#[tauri::command]
pub async fn camofox_links(
    tab_id: u32,
    limit: Option<u32>,
    offset: Option<u32>,
    app: AppHandle,
) -> Result<Value, String> {
    let handle = current_handle(&app, tab_id)?;
    let client = CamofoxClient::from_environment()?;
    refresh_surface_policy(&app, tab_id, &client, &handle).await?;
    client
        .links(
            &handle.remote_tab_id,
            &handle.user_id,
            limit.unwrap_or(50),
            offset.unwrap_or(0),
        )
        .await
}

/// Click a current-page accessibility reference or selector through Camofox.
#[tauri::command]
pub async fn camofox_click(
    tab_id: u32,
    reference: Option<String>,
    selector: Option<String>,
    app: AppHandle,
) -> Result<Value, String> {
    let handle = current_handle(&app, tab_id)?;
    let client = CamofoxClient::from_environment()?;
    let result = client
        .click(
            &handle.remote_tab_id,
            &handle.user_id,
            reference.as_deref(),
            selector.as_deref(),
        )
        .await?;
    refresh_surface_policy(&app, tab_id, &client, &handle).await?;
    Ok(result)
}

/// Fill a current-page accessibility reference or selector through Camofox.
#[tauri::command]
pub async fn camofox_type(
    tab_id: u32,
    reference: Option<String>,
    selector: Option<String>,
    text: String,
    press_enter: Option<bool>,
    app: AppHandle,
) -> Result<Value, String> {
    let handle = current_handle(&app, tab_id)?;
    let client = CamofoxClient::from_environment()?;
    let result = client
        .type_text(
            &handle.remote_tab_id,
            &handle.user_id,
            reference.as_deref(),
            selector.as_deref(),
            &text,
            press_enter.unwrap_or(false),
        )
        .await?;
    refresh_surface_policy(&app, tab_id, &client, &handle).await?;
    Ok(result)
}

/// Press a bounded keyboard key through Camofox and revalidate the page.
#[tauri::command]
pub async fn camofox_press(
    tab_id: u32,
    key: String,
    app: AppHandle,
) -> Result<Value, String> {
    let handle = current_handle(&app, tab_id)?;
    let client = CamofoxClient::from_environment()?;
    let result = client
        .press(&handle.remote_tab_id, &handle.user_id, &key)
        .await?;
    refresh_surface_policy(&app, tab_id, &client, &handle).await?;
    Ok(result)
}

/// Wait for the Camofox page to settle with a bounded timeout, then revalidate.
#[tauri::command]
pub async fn camofox_wait(
    tab_id: u32,
    timeout: Option<u32>,
    wait_for_network: Option<bool>,
    dismiss_consent: Option<bool>,
    app: AppHandle,
) -> Result<Value, String> {
    let handle = current_handle(&app, tab_id)?;
    let client = CamofoxClient::from_environment()?;
    let result = client
        .wait(
            &handle.remote_tab_id,
            &handle.user_id,
            timeout.unwrap_or_else(crate::camofox_client_actions::default_wait_timeout),
            wait_for_network.unwrap_or(true),
            dismiss_consent.unwrap_or(false),
        )
        .await?;
    refresh_surface_policy(&app, tab_id, &client, &handle).await?;
    Ok(result)
}

/// Scroll a Camofox page through a bounded direction and amount.
#[tauri::command]
pub async fn camofox_scroll(
    tab_id: u32,
    direction: String,
    amount: Option<u32>,
    app: AppHandle,
) -> Result<Value, String> {
    let handle = current_handle(&app, tab_id)?;
    let client = CamofoxClient::from_environment()?;
    let result = client
        .scroll(
            &handle.remote_tab_id,
            &handle.user_id,
            &direction,
            amount.unwrap_or(500),
        )
        .await?;
    refresh_surface_policy(&app, tab_id, &client, &handle).await?;
    Ok(result)
}

fn current_handle<R: tauri::Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
) -> Result<crate::camofox_client::CamofoxTabHandle, String> {
    app.state::<TabWindows>()
        .camofox_tabs
        .lock()
        .map_err(|error| error.to_string())?
        .get(&tab_id)
        .cloned()
        .ok_or_else(|| "camofox_tab_not_found".to_string())
}

async fn enforce_reported_url<R: tauri::Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
    url: &str,
) -> Result<(), String> {
    let session = app
        .try_state::<AppState>()
        .map(|state| {
            state
                .session
                .lock()
                .map(|value| value.clone())
                .unwrap_or_default()
        })
        .unwrap_or_else(Session::default);
    let policy = classify_tab_navigation(url, &session);
    if !window_allowed(&policy) || policy.request_privileged {
        let _ = crate::tab_windows_camofox::close(app, tab_id).await;
        let reason = if policy.request_privileged {
            "camofox_attestation_bridge_unavailable"
        } else {
            &policy.reason
        };
        return Err(format!("camofox_surface_refused:{reason}"));
    }
    if let Ok(mut handles) = app.state::<TabWindows>().camofox_tabs.lock() {
        if let Some(handle) = handles.get_mut(&tab_id) {
            handle.current_url = url.to_string();
        }
    }
    Ok(())
}

async fn refresh_surface_policy<R: tauri::Runtime>(
    app: &AppHandle<R>,
    tab_id: u32,
    client: &CamofoxClient,
    handle: &crate::camofox_client::CamofoxTabHandle,
) -> Result<(), String> {
    let result = client
        .snapshot(&handle.remote_tab_id, &handle.user_id, false)
        .await?;
    let url = result
        .get("url")
        .and_then(Value::as_str)
        .ok_or_else(|| "camofox_snapshot_url_missing".to_string())?;
    enforce_reported_url(app, tab_id, url).await
}
