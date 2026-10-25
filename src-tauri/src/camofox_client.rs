//! Bounded loopback client for the local Camofox browser service.

use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use url::Url;

pub const DEFAULT_CAMOFOX_ORIGIN: &str = "http://127.0.0.1:9377";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CamofoxVncStatus {
    pub enabled: bool,
    pub running: bool,
    #[serde(rename = "novncPort")]
    pub novnc_port: u16,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CamofoxTab {
    #[serde(rename = "tabId")]
    pub tab_id: String,
    pub url: String,
}

#[derive(Debug, Clone)]
pub struct CamofoxTabHandle {
    pub user_id: String,
    pub session_key: String,
    pub remote_tab_id: String,
    pub current_url: String,
    pub vnc_port: u16,
}

#[derive(Debug, Clone)]
pub struct CamofoxClient {
    origin: Url,
    bearer: Option<String>,
    http: Client,
}

impl CamofoxClient {
    /// Construct a loopback-only client from GENYSYS configuration.
    pub fn from_environment() -> Result<Self, String> {
        let origin = std::env::var("GENYSYS_CAMOFOX_URL")
            .unwrap_or_else(|_| DEFAULT_CAMOFOX_ORIGIN.to_string());
        let bearer = std::env::var("CAMOFOX_ACCESS_KEY")
            .ok()
            .or_else(|| std::env::var("CAMOFOX_API_KEY").ok())
            .filter(|value| !value.is_empty());
        Self::new(&origin, bearer)
    }

    /// Construct a client after validating the service origin and timeout.
    pub fn new(origin: &str, bearer: Option<String>) -> Result<Self, String> {
        let origin = validate_loopback_origin(origin)?;
        let http = Client::builder()
            .connect_timeout(REQUEST_TIMEOUT)
            .timeout(REQUEST_TIMEOUT)
            .build()
            .map_err(|_| "camofox_http_client_unavailable".to_string())?;
        Ok(Self {
            origin,
            bearer,
            http,
        })
    }

    /// Confirm the Camofox service is reachable and reports healthy.
    pub async fn health(&self) -> Result<(), String> {
        let body = self.request(Method::GET, "/health", None, None).await?;
        if body.get("ok").and_then(Value::as_bool) == Some(true) {
            return Ok(());
        }
        Err("camofox_not_ready".into())
    }

    /// Confirm that the interactive noVNC surface is actually available.
    pub async fn vnc_status(&self) -> Result<CamofoxVncStatus, String> {
        let body = self.request(Method::GET, "/vnc/status", None, None).await?;
        let status: CamofoxVncStatus =
            serde_json::from_value(body).map_err(|_| "camofox_vnc_status_malformed".to_string())?;
        if !status.enabled || !status.running || status.path != "/vnc.html" {
            return Err("camofox_vnc_unavailable".into());
        }
        Ok(status)
    }

    /// Create one remote Camofox page for one GENYSYS logical tab.
    pub async fn create_tab(&self, user_id: &str, session_key: &str) -> Result<CamofoxTab, String> {
        validate_identity(user_id, session_key)?;
        let body = self
            .request(
                Method::POST,
                "/tabs",
                None,
                Some(json!({ "userId": user_id, "sessionKey": session_key })),
            )
            .await?;
        parse_tab(body)
    }

    /// Run one history action against the remote page.
    pub async fn history(
        &self,
        tab_id: &str,
        user_id: &str,
        action: &str,
    ) -> Result<String, String> {
        let tab_id = validate_path_segment(tab_id)?;
        if user_id.trim().is_empty() {
            return Err("camofox_user_id_missing".into());
        }
        let path = match action {
            "back" | "forward" => format!("/tabs/{tab_id}/{action}"),
            "refresh" | "reload" => format!("/tabs/{tab_id}/refresh"),
            _ => return Err("camofox_history_action_invalid".into()),
        };
        let body = self
            .request(
                Method::POST,
                &path,
                None,
                Some(json!({ "userId": user_id })),
            )
            .await?;
        parse_url_result(body, false)
    }

    /// Read the Camofox accessibility snapshot for the current remote page.
    pub async fn snapshot(
        &self,
        tab_id: &str,
        user_id: &str,
        include_screenshot: bool,
    ) -> Result<Value, String> {
        let tab_id = validate_path_segment(tab_id)?;
        validate_user_id(user_id)?;
        let include_screenshot = if include_screenshot { "true" } else { "false" };
        let query = [
            ("userId", user_id),
            ("includeScreenshot", include_screenshot),
        ];
        self.request(
            Method::GET,
            &format!("/tabs/{tab_id}/snapshot"),
            Some(&query),
            None,
        )
        .await
    }

    /// Read the current page's bounded HTTP links.
    pub async fn links(
        &self,
        tab_id: &str,
        user_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Value, String> {
        let tab_id = validate_path_segment(tab_id)?;
        validate_user_id(user_id)?;
        if !(1..=500).contains(&limit) || offset > 100_000 {
            return Err("camofox_links_paging_invalid".into());
        }
        let limit = limit.to_string();
        let offset = offset.to_string();
        let query = [
            ("userId", user_id),
            ("limit", limit.as_str()),
            ("offset", offset.as_str()),
        ];
        self.request(
            Method::GET,
            &format!("/tabs/{tab_id}/links"),
            Some(&query),
            None,
        )
        .await
    }

    /// Click one current-page accessibility reference or validated selector.
    pub async fn click(
        &self,
        tab_id: &str,
        user_id: &str,
        reference: Option<&str>,
        selector: Option<&str>,
    ) -> Result<Value, String> {
        let tab_id = validate_path_segment(tab_id)?;
        validate_user_id(user_id)?;
        validate_action_target(reference, selector, "camofox_click_target_missing")?;
        self.request(
            Method::POST,
            &format!("/tabs/{tab_id}/click"),
            None,
            Some(json!({
                "userId": user_id,
                "ref": reference,
                "selector": selector,
            })),
        )
        .await
    }

    /// Fill a current-page reference or selector with text and optionally submit.
    pub async fn type_text(
        &self,
        tab_id: &str,
        user_id: &str,
        reference: Option<&str>,
        selector: Option<&str>,
        text: &str,
        press_enter: bool,
    ) -> Result<Value, String> {
        let tab_id = validate_path_segment(tab_id)?;
        validate_user_id(user_id)?;
        validate_action_target(reference, selector, "camofox_type_target_missing")?;
        if text.len() > 100_000 {
            return Err("camofox_type_text_too_large".into());
        }
        self.request(
            Method::POST,
            &format!("/tabs/{tab_id}/type"),
            None,
            Some(json!({
                "userId": user_id,
                "ref": reference,
                "selector": selector,
                "text": text,
                "mode": "fill",
                "pressEnter": press_enter,
            })),
        )
        .await
    }

    /// Scroll the remote page by a bounded amount.
    pub async fn scroll(
        &self,
        tab_id: &str,
        user_id: &str,
        direction: &str,
        amount: u32,
    ) -> Result<Value, String> {
        let tab_id = validate_path_segment(tab_id)?;
        validate_user_id(user_id)?;
        validate_scroll_arguments(direction, amount)?;
        self.request(
            Method::POST,
            &format!("/tabs/{tab_id}/scroll"),
            None,
            Some(json!({
                "userId": user_id,
                "direction": direction,
                "amount": amount,
            })),
        )
        .await
    }

    /// Close a remote page without exposing its session token to the UI.
    pub async fn close(&self, tab_id: &str, user_id: &str) -> Result<(), String> {
        let tab_id = validate_path_segment(tab_id)?;
        if user_id.trim().is_empty() {
            return Err("camofox_user_id_missing".into());
        }
        self.request(
            Method::DELETE,
            &format!("/tabs/{tab_id}"),
            Some(&[("userId", user_id)]),
            None,
        )
        .await
        .map(|_| ())
    }

    pub(crate) async fn request(
        &self,
        method: Method,
        path: &str,
        query: Option<&[(&str, &str)]>,
        body: Option<Value>,
    ) -> Result<Value, String> {
        let url = self
            .origin
            .join(path.trim_start_matches('/'))
            .map_err(|_| "camofox_request_url_invalid".to_string())?;
        let mut request = self.http.request(method, url);
        if let Some(query) = query {
            request = request.query(query);
        }
        if let Some(bearer) = &self.bearer {
            request = request.bearer_auth(bearer);
        }
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request
            .send()
            .await
            .map_err(|_| "camofox_service_unreachable".to_string())?;
        let status = response.status();
        let bytes = response
            .bytes()
            .await
            .map_err(|_| "camofox_response_malformed".to_string())?;
        if bytes.len() > 8 * 1024 * 1024 {
            return Err("camofox_response_too_large".into());
        }
        let body = serde_json::from_slice::<Value>(&bytes)
            .map_err(|_| "camofox_response_malformed".to_string())?;
        if !status.is_success() {
            if let Some(error) = body.get("error").and_then(Value::as_str) {
                if error.starts_with("camofox_redirect_refused:")
                    || error == "camofox_redirect_guard_missing"
                {
                    return Err(error.to_string());
                }
            }
            return Err(format!("camofox_http_status:{}", status.as_u16()));
        }
        Ok(body)
    }
}

pub(crate) fn validate_loopback_origin(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| "camofox_url_invalid".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("camofox_url_scheme_invalid".into());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "camofox_url_host_missing".to_string())?
        .to_ascii_lowercase();
    if !matches!(host.as_str(), "127.0.0.1" | "localhost" | "::1") {
        return Err("camofox_url_must_be_loopback".into());
    }
    if url.path() != "/" || url.query().is_some() || url.fragment().is_some() {
        return Err("camofox_url_must_be_origin".into());
    }
    Ok(url)
}

pub(crate) fn validate_identity(user_id: &str, session_key: &str) -> Result<(), String> {
    validate_user_id(user_id)?;
    if session_key.trim().is_empty() {
        return Err("camofox_session_key_missing".into());
    }
    Ok(())
}

pub(crate) fn validate_user_id(user_id: &str) -> Result<(), String> {
    if user_id.trim().is_empty() {
        return Err("camofox_user_id_missing".into());
    }
    Ok(())
}

pub(crate) fn validate_action_target(
    reference: Option<&str>,
    selector: Option<&str>,
    reason: &str,
) -> Result<(), String> {
    let has_reference = reference.is_some_and(|value| !value.trim().is_empty());
    let has_selector = selector.is_some_and(|value| !value.trim().is_empty());
    if !has_reference && !has_selector {
        return Err(reason.to_string());
    }
    if reference.is_some_and(|value| value.len() > 128)
        || selector.is_some_and(|value| value.len() > 4_096)
    {
        return Err("camofox_action_target_too_large".into());
    }
    Ok(())
}

pub(crate) fn validate_scroll_arguments(direction: &str, amount: u32) -> Result<(), String> {
    if !matches!(direction, "up" | "down" | "left" | "right") || !(1..=10_000).contains(&amount) {
        return Err("camofox_scroll_arguments_invalid".into());
    }
    Ok(())
}

pub(crate) fn validate_destination(value: &str) -> Result<(), String> {
    let url = Url::parse(value).map_err(|_| "camofox_destination_invalid".to_string())?;
    let authority = value
        .split_once("://")
        .and_then(|(_, rest)| rest.split('/').next())
        .filter(|host| !host.is_empty());
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() || authority.is_none()
    {
        return Err("camofox_destination_invalid".into());
    }
    Ok(())
}

pub(crate) fn validate_path_segment(value: &str) -> Result<String, String> {
    if value.is_empty()
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        return Err("camofox_tab_id_invalid".into());
    }
    Ok(value.to_string())
}

fn parse_tab(body: Value) -> Result<CamofoxTab, String> {
    serde_json::from_value(body).map_err(|_| "camofox_tab_response_malformed".to_string())
}

fn parse_url_result(body: Value, check_navigation: bool) -> Result<String, String> {
    if check_navigation && body.get("navigationOk").and_then(Value::as_bool) == Some(false) {
        return Err("camofox_navigation_refused".into());
    }
    body.get("url")
        .and_then(Value::as_str)
        .filter(|url| !url.is_empty())
        .map(ToString::to_string)
        .ok_or_else(|| "camofox_navigation_response_malformed".into())
}

