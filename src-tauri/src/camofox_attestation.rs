//! First-request GENYSYS attestation for Camofox privileged navigations.
//!
//! Mint the documented `genysys_attest` bootstrap cookie and import it into the
//! Camofox browser context before the first privileged request is issued.

use crate::attestation::{self, COOKIE_NAME};
use crate::camofox_client::CamofoxClient;
use crate::Session;
use serde_json::{json, Value};
use url::Url;

const TTL_SECS: u64 = 8 * 3600;

/// Import the GENYSYS attestation cookie into the Camofox session for one RNK host.
pub async fn arm_privileged_navigation(
    client: &CamofoxClient,
    user_id: &str,
    destination: &str,
    session: &Session,
) -> Result<(), String> {
    let token = session
        .session_token
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "camofox_attestation_session_missing".to_string())?;
    let domain = attestation_cookie_domain(destination)?;
    let body = attestation::bootstrap_json(token, &session.access_tier, TTL_SECS);
    let value = body
        .get("value")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "camofox_attestation_cookie_invalid".to_string())?;
    let expires = cookie_expiry_unix(body.get("maxAge").and_then(Value::as_u64).unwrap_or(TTL_SECS));
    let cookies = vec![json!({
        "name": COOKIE_NAME,
        "value": value,
        "domain": domain,
        "path": "/",
        "expires": expires,
        "httpOnly": false,
        "secure": true,
        "sameSite": "Lax",
    })];
    client.import_cookies(user_id, &cookies).await
}

/// RNK product hosts share one parent cookie domain for first-request coverage.
pub(crate) fn attestation_cookie_domain(destination: &str) -> Result<String, String> {
    let url = Url::parse(destination).map_err(|_| "camofox_attestation_url_invalid".to_string())?;
    if url.scheme() != "https" {
        return Err("camofox_attestation_url_must_be_https".into());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "camofox_attestation_url_host_missing".to_string())?
        .to_ascii_lowercase();
    let host = host.trim_start_matches("www.");
    if host == "rnk-enterprise.us" || host.ends_with(".rnk-enterprise.us") {
        return Ok(".rnk-enterprise.us".into());
    }
    Err("camofox_attestation_host_unsupported".into())
}

fn cookie_expiry_unix(max_age_secs: u64) -> i64 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    (now + max_age_secs) as i64
}

#[cfg(test)]
mod tests {
    use super::attestation_cookie_domain;

    #[test]
    fn cookie_domain_covers_rnk_product_hosts() {
        assert_eq!(
            attestation_cookie_domain("https://mail.rnk-enterprise.us/inbox").unwrap(),
            ".rnk-enterprise.us"
        );
        assert_eq!(
            attestation_cookie_domain("https://rnk-enterprise.us/").unwrap(),
            ".rnk-enterprise.us"
        );
        assert!(attestation_cookie_domain("http://mail.rnk-enterprise.us/").is_err());
        assert!(attestation_cookie_domain("https://example.com/").is_err());
    }
}
