//! VEIL attestation — pure validation logic (unit-testable).
//! Header names are documented in docs/VEIL_ATTESTATION.md; the session token
//! is per-session and is not a secret in git.

use serde_json::json;

// Part of the documented contract (docs/VEIL_ATTESTATION.md); products and
// tests consume these even when the VEIL binary itself does not.
#[allow(dead_code)]
pub const CLIENT_HEADER: &str = "x-veil-client";
#[allow(dead_code)]
pub const SESSION_HEADER: &str = "x-veil-session";
#[allow(dead_code)]
pub const TIER_HEADER: &str = "x-veil-tier";
pub const COOKIE_NAME: &str = "veil_attest";

/// Refuse reasons are stable strings products can log.
pub const REASON_MISSING: &str = "veil_attestation_missing";
#[allow(dead_code)]
pub const REASON_EXPIRED: &str = "veil_attestation_expired";
#[allow(dead_code)]
pub const REASON_FORBIDDEN: &str = "veil_attestation_forbidden";

#[derive(Debug, PartialEq)]
pub struct Attestation {
    pub client: String,
    pub session: String,
    pub tier: String,
}

// Server-side mirror of the product gates; consumed by tests and available
// for native-side enforcement of inbound RNK traffic.
#[allow(dead_code)]
impl Attestation {
    fn expired_at(&self) -> Option<u64> {
        // Bootstrap cookie sessions carry an explicit expiry:
        // `axb_<expiry_ms>_<token>`. Native shell tokens have no embedded
        // expiry here (the shell owns their lifecycle) → None.
        let rest = self.session.strip_prefix("axb_")?;
        let exp = rest.split('_').next()?;
        exp.parse().ok()
    }

    pub fn is_expired(&self, now_ms: u64) -> bool {
        match self.expired_at() {
            Some(exp) => now_ms >= exp,
            None => false,
        }
    }

    pub fn tier_allowed(&self, allowed: &[&str]) -> bool {
        allowed.iter().any(|t| t.eq_ignore_ascii_case(&self.tier))
    }
}

#[allow(dead_code)] // server-side mirror of the product gates; used by tests
fn header_value(headers: &serde_json::Value, name: &str) -> Option<String> {
    headers.get(name).and_then(|v| v.as_str()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

/// Validate a request's VEIL attestation from headers (server-side mirror of
/// the JS check used by Raven/Echonet/Mail).
#[allow(dead_code)] // server-side mirror; see module docs
pub fn validate(
    headers: &serde_json::Value,
    now_ms: u64,
    allowed_tiers: &[&str],
) -> Result<Attestation, &'static str> {
    let client = header_value(headers, CLIENT_HEADER).ok_or(REASON_MISSING)?;
    if client != "1" {
        return Err(REASON_MISSING);
    }
    let session = header_value(headers, SESSION_HEADER).ok_or(REASON_MISSING)?;
    let tier = header_value(headers, TIER_HEADER).unwrap_or_default();

    let att = Attestation { client, session, tier };
    if att.is_expired(now_ms) {
        return Err(REASON_EXPIRED);
    }
    if !att.tier_allowed(allowed_tiers) {
        return Err(REASON_FORBIDDEN);
    }
    Ok(att)
}

/// Build the JSON body VEIL serves on an attestation bootstrap page.
/// The products' JS sets this as a cookie so every subsequent request
/// (including iframe subresource loads) carries the attestation.
/// Value format: `axb_<expiry_ms>_<token>`.
pub fn bootstrap_json(token: &str, tier: &str, ttl_secs: u64) -> serde_json::Value {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    json!({
        "cookie": COOKIE_NAME,
        "value": format!("axb_{}_{}", now + ttl_secs * 1000, token),
        "maxAge": ttl_secs,
        "tier": tier,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const NOW: u64 = 1_800_000_000_000;

    #[test]
    fn valid_attestation_passes() {
        let headers = json!({
            "x-veil-client": "1",
            "x-veil-session": "tok-123",
            "x-veil-tier": "agent"
        });
        let att = validate(&headers, NOW, &["agent", "full"]).unwrap();
        assert_eq!(att.session, "tok-123");
    }

    #[test]
    fn missing_headers_refused() {
        let headers = json!({ "cookie": "whatever" });
        assert_eq!(validate(&headers, NOW, &["agent"]).unwrap_err(), REASON_MISSING);
    }

    #[test]
    fn wrong_client_value_refused() {
        let headers = json!({
            "x-veil-client": "0",
            "x-veil-session": "tok",
            "x-veil-tier": "agent"
        });
        assert_eq!(validate(&headers, NOW, &["agent"]).unwrap_err(), REASON_MISSING);
    }

    #[test]
    fn expired_session_refused() {
        let headers = json!({
            "x-veil-client": "1",
            "x-veil-session": "axb_1799999999000_bootstrap",
            "x-veil-tier": "agent"
        });
        assert_eq!(validate(&headers, NOW, &["agent"]).unwrap_err(), REASON_EXPIRED);
    }

    #[test]
    fn bootstrap_session_valid_until_expiry() {
        let headers = json!({
            "x-veil-client": "1",
            "x-veil-session": "axb_1800036000000_bootstrap",
            "x-veil-tier": "agent"
        });
        assert!(validate(&headers, NOW, &["agent"]).is_ok());
    }

    #[test]
    fn wrong_tier_refused() {
        let headers = json!({
            "x-veil-client": "1",
            "x-veil-session": "tok",
            "x-veil-tier": "agency"
        });
        assert_eq!(validate(&headers, NOW, &["agent", "full"]).unwrap_err(), REASON_FORBIDDEN);
    }

    #[test]
    fn bootstrap_json_shape() {
        let body = bootstrap_json("tok", "agent", 3600);
        assert_eq!(body["cookie"], COOKIE_NAME);
        let value = body["value"].as_str().unwrap();
        assert!(value.starts_with("axb_"), "bootstrap value must use axb_ format");
        assert!(value.ends_with("_tok"));
        let exp: u64 = value
            .trim_start_matches("axb_")
            .split('_')
            .next()
            .unwrap()
            .parse()
            .unwrap();
        assert!(exp > 1_700_000_000_000, "expiry must be an epoch-ms timestamp");
        assert_eq!(body["maxAge"], 3600);
    }
}
