//! Bounded keyboard, readiness, and attestation-cookie actions for Camofox.

use crate::camofox_client::{validate_path_segment, validate_user_id, CamofoxClient};
use reqwest::Method;
use serde_json::{json, Value};

const DEFAULT_WAIT_MS: u32 = 10_000;
const MAX_WAIT_MS: u32 = 60_000;
const MAX_KEY_BYTES: usize = 64;
const MAX_COOKIE_IMPORT: usize = 16;

impl CamofoxClient {
    /// Import Playwright-format cookies into one Camofox user session.
    pub async fn import_cookies(&self, user_id: &str, cookies: &[Value]) -> Result<(), String> {
        validate_user_id(user_id)?;
        if cookies.is_empty() || cookies.len() > MAX_COOKIE_IMPORT {
            return Err("camofox_cookies_count_invalid".into());
        }
        for cookie in cookies {
            let name = cookie.get("name").and_then(Value::as_str).unwrap_or_default();
            let value = cookie.get("value").and_then(Value::as_str);
            let domain = cookie.get("domain").and_then(Value::as_str).unwrap_or_default();
            if name.is_empty() || value.is_none() || domain.is_empty() {
                return Err("camofox_cookie_fields_invalid".into());
            }
        }
        let encoded_user = urlencoding_path_segment(user_id)?;
        let body = self
            .request(
                Method::POST,
                &format!("/sessions/{encoded_user}/cookies"),
                None,
                Some(json!({ "cookies": cookies })),
            )
            .await?;
        if body.get("ok").and_then(Value::as_bool) != Some(true) {
            return Err("camofox_cookie_import_refused".into());
        }
        Ok(())
    }

    /// Press one bounded browser key through the Camofox service.
    pub async fn press(
        &self,
        tab_id: &str,
        user_id: &str,
        key: &str,
    ) -> Result<Value, String> {
        let tab_id = validate_path_segment(tab_id)?;
        validate_user_id(user_id)?;
        validate_key(key)?;
        self.request(
            Method::POST,
            &format!("/tabs/{tab_id}/press"),
            None,
            Some(json!({ "userId": user_id, "key": key })),
        )
        .await
    }

    /// Wait for the remote page's readiness contract with a bounded timeout.
    pub async fn wait(
        &self,
        tab_id: &str,
        user_id: &str,
        timeout_ms: u32,
        wait_for_network: bool,
        dismiss_consent: bool,
    ) -> Result<Value, String> {
        let tab_id = validate_path_segment(tab_id)?;
        validate_user_id(user_id)?;
        validate_wait_timeout(timeout_ms)?;
        self.request(
            Method::POST,
            &format!("/tabs/{tab_id}/wait"),
            None,
            Some(json!({
                "userId": user_id,
                "timeout": timeout_ms,
                "waitForNetwork": wait_for_network,
                "dismissConsent": dismiss_consent,
            })),
        )
        .await
    }
}

pub(crate) fn default_wait_timeout() -> u32 {
    DEFAULT_WAIT_MS
}

fn validate_key(key: &str) -> Result<(), String> {
    if key.trim().is_empty()
        || key.len() > MAX_KEY_BYTES
        || key.chars().any(char::is_control)
    {
        return Err("camofox_key_invalid".into());
    }
    Ok(())
}

fn validate_wait_timeout(timeout_ms: u32) -> Result<(), String> {
    if !(1..=MAX_WAIT_MS).contains(&timeout_ms) {
        return Err("camofox_wait_timeout_invalid".into());
    }
    Ok(())
}

fn urlencoding_path_segment(value: &str) -> Result<String, String> {
    if value.is_empty()
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'@'))
    {
        return Err("camofox_user_id_invalid".into());
    }
    Ok(value.to_string())
}

#[cfg(test)]
mod tests {
    use super::{default_wait_timeout, validate_key, validate_wait_timeout};

    #[test]
    fn keyboard_and_wait_arguments_are_bounded() {
        assert_eq!(default_wait_timeout(), 10_000);
        assert!(validate_key("Enter").is_ok());
        assert!(validate_key("Control+L").is_ok());
        assert!(validate_key(" ").is_err());
        assert!(validate_key("Enter\n").is_err());
        assert!(validate_wait_timeout(1).is_ok());
        assert!(validate_wait_timeout(60_000).is_ok());
        assert!(validate_wait_timeout(0).is_err());
        assert!(validate_wait_timeout(60_001).is_err());
    }
}
