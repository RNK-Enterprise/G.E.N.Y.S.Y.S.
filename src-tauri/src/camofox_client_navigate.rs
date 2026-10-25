//! Camofox navigate contract with hop-by-hop GENYSYS policy callbacks.

use crate::camofox_client::{
    validate_destination, validate_identity, validate_path_segment, CamofoxClient,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use url::Url;

/// Hop-by-hop GENYSYS policy callback dialed by Camofox during navigation.
#[derive(Debug, Clone)]
pub struct CamofoxNavigatePolicy {
    pub callback_url: String,
    pub token: String,
    pub tab_id: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CamofoxNavigateHop {
    pub url: String,
    pub decision: String,
    pub reason: String,
    pub hop: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CamofoxNavigateResult {
    pub url: String,
    pub hops: Vec<CamofoxNavigateHop>,
}

impl CamofoxClient {
    /// Navigate the remote page after GENYSYS policy has allowed the target.
    ///
    /// When `policy` is set, Camofox must pause each main-frame hop against the
    /// GENYSYS callback and return the hop chain. A missing chain fails closed.
    pub async fn navigate(
        &self,
        tab_id: &str,
        user_id: &str,
        session_key: &str,
        url: &str,
        policy: Option<&CamofoxNavigatePolicy>,
    ) -> Result<CamofoxNavigateResult, String> {
        let tab_id = validate_path_segment(tab_id)?;
        validate_identity(user_id, session_key)?;
        validate_destination(url)?;
        if let Some(policy) = policy {
            validate_loopback_callback(&policy.callback_url)?;
            if policy.token.trim().is_empty() {
                return Err("camofox_policy_token_missing".into());
            }
        }
        let mut payload = json!({
            "userId": user_id,
            "sessionKey": session_key,
            "url": url,
        });
        if let Some(policy) = policy {
            payload["policyCallback"] = json!(policy.callback_url);
            payload["policyToken"] = json!(policy.token);
            payload["policyTabId"] = json!(policy.tab_id);
        }
        let body = self
            .request(
                reqwest::Method::POST,
                &format!("/tabs/{tab_id}/navigate"),
                None,
                Some(payload),
            )
            .await?;
        parse_navigate_result(body, policy.is_some())
    }
}

pub(crate) fn parse_navigate_result(
    body: Value,
    require_guard: bool,
) -> Result<CamofoxNavigateResult, String> {
    if body.get("navigationOk").and_then(Value::as_bool) == Some(false) {
        return Err("camofox_navigation_refused".into());
    }
    let url = body
        .get("url")
        .and_then(Value::as_str)
        .filter(|url| !url.is_empty())
        .map(ToString::to_string)
        .ok_or_else(|| "camofox_navigation_response_malformed".to_string())?;
    let hops = parse_hops(body.get("hops"))?;
    if require_guard && hops.is_empty() {
        return Err("camofox_redirect_guard_missing".into());
    }
    if hops.iter().any(|hop| hop.decision != "allow") {
        return Err("camofox_redirect_guard_inconsistent".into());
    }
    Ok(CamofoxNavigateResult { url, hops })
}

fn parse_hops(value: Option<&Value>) -> Result<Vec<CamofoxNavigateHop>, String> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };
    let Some(items) = value.as_array() else {
        return Err("camofox_navigation_hops_malformed".into());
    };
    if items.len() > 32 {
        return Err("camofox_navigation_hops_too_long".into());
    }
    items
        .iter()
        .map(|item| {
            serde_json::from_value::<CamofoxNavigateHop>(item.clone())
                .map_err(|_| "camofox_navigation_hops_malformed".to_string())
        })
        .collect()
}

pub(crate) fn validate_loopback_callback(value: &str) -> Result<(), String> {
    let url = Url::parse(value).map_err(|_| "camofox_policy_callback_invalid".to_string())?;
    if url.scheme() != "http" {
        return Err("camofox_policy_callback_invalid".into());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "camofox_policy_callback_invalid".to_string())?
        .to_ascii_lowercase();
    if !matches!(host.as_str(), "127.0.0.1" | "localhost" | "::1") {
        return Err("camofox_policy_callback_must_be_loopback".into());
    }
    if url.path() != "/camofox/policy/check" {
        return Err("camofox_policy_callback_path_invalid".into());
    }
    Ok(())
}
