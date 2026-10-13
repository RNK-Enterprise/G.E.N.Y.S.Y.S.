//! P.R.O.T.E.C.T.S. embedded policy for standalone GENYSYS.
//! (Formerly "Lisa policy" — the mind is P.R.O.T.E.C.T.S.; Resolute is the handshake organ.)
//!
//! Fail-closed: any undecidable / error path returns block. Never fail open.

use crate::{PolicyResult, Session};
use url::Url;

const INTERNAL_SCHEMES: &[&str] = &["genysys", "about", "data", "blob"];

/// RNK product surfaces. Authenticated GENYSYS sessions may open these; a normal
/// browser must be refused by the products' own attestation checks (see
/// docs/GENYSYS_ATTESTATION.md). `sec.` is the private pentest surface — it is
/// NOT part of the default agent chrome and is excluded here.
const RNK_PRODUCT_HOSTS: &[&str] = &[
    "rnk-enterprise.us",
    "raven.rnk-enterprise.us",
    "echonet.rnk-enterprise.us",
    "mail.rnk-enterprise.us",
    "demo.rnk-enterprise.us",
    "app.rnk-enterprise.us",
];

/// Loopback/metadata destinations that must never load in a webview
/// (SSRF / internal service reachability through GENYSYS).
const BLOCKED_HOSTS: &[&str] = &[
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "169.254.169.254",
];

fn extract_domain(url: &str) -> String {
    if let Ok(parsed) = Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            return host.trim_start_matches("www.").to_lowercase();
        }
        if let Some(scheme) = Some(parsed.scheme()) {
            if INTERNAL_SCHEMES.contains(&scheme) {
                return format!("{}://", scheme);
            }
        }
    }
    // Bare host or genysys:// without standard parse
    if url.starts_with("genysys://") {
        return "genysys://".into();
    }
    url.to_string()
}

fn is_internal(url: &str) -> bool {
    let lower = url.to_lowercase();
    INTERNAL_SCHEMES.iter().any(|s| lower.starts_with(&format!("{}:", s)))
        || lower == "about:blank"
}

fn host_matches(host: &str, list: &[&str]) -> bool {
    let host = host.trim_start_matches("www.").to_lowercase();
    list.iter().any(|d| host == *d || host.ends_with(&format!(".{}", d)))
}

fn is_authenticated(session: &Session) -> bool {
    session.session_token.as_ref().map(|t| !t.is_empty()).unwrap_or(false)
}

/// Local in-process policy. Must not panic; on logic failure return block.
pub fn evaluate_local(url: &str, session: &Session) -> PolicyResult {
    let domain = extract_domain(url);

    if is_internal(url) {
        return PolicyResult {
            decision: "allow".into(),
            reason: "internal_genysys_surface".into(),
            audit: false,
            notify: false,
            chain: false,
            request_required: false,
            request_privileged: false,
            domain,
            source: "local".into(),
        };
    }

    if !is_authenticated(session) {
        return PolicyResult {
            decision: "block".into(),
            reason: "unauthenticated".into(),
            audit: true,
            notify: false,
            chain: false,
            request_required: false,
            request_privileged: false,
            domain,
            source: "local".into(),
        };
    }

    let lower = url.to_lowercase();
    let ok_scheme = lower.starts_with("https://")
        || lower.starts_with("http://")
        || (!lower.contains("://") && !lower.is_empty());

    if !ok_scheme {
        return PolicyResult {
            decision: "block".into(),
            reason: "scheme_not_allowed".into(),
            audit: true,
            notify: true,
            chain: false,
            request_required: false,
            request_privileged: false,
            domain,
            source: "local".into(),
        };
    }

    // Parse for host checks; unparseable external URL → block.
    let candidate = if url.starts_with("http") {
        url.to_string()
    } else {
        format!("https://{}", url)
    };
    let parsed = match Url::parse(&candidate) {
        Ok(p) => p,
        Err(_) => {
            return PolicyResult {
                decision: "block".into(),
                reason: "url_unparseable_fail_closed".into(),
                audit: true,
                notify: true,
                chain: false,
                request_required: false,
                request_privileged: false,
                domain,
                source: "local".into(),
            };
        }
    };
    let host = parsed.host_str().unwrap_or("").to_lowercase();
    let scheme = parsed.scheme().to_lowercase();

    // Loopback / metadata targets are never loadable in a tab (checked before
    // the scheme gate so the refusal names the real reason).
    if host_matches(&host, BLOCKED_HOSTS) {
        return PolicyResult {
            decision: "block".into(),
            reason: "internal_destination_blocked".into(),
            audit: true,
            notify: true,
            chain: false,
            request_required: false,
            request_privileged: false,
            domain,
            source: "local".into(),
        };
    }

    // Plain http to anywhere else is refused (https only off-loopback).
    if scheme == "http" {
        return PolicyResult {
            decision: "block".into(),
            reason: "scheme_not_allowed".into(),
            audit: true,
            notify: true,
            chain: false,
            request_required: false,
            request_privileged: false,
            domain,
            source: "local".into(),
        };
    }

    // Tier gates — locked/none never browse external
    let tier = session.access_tier.to_lowercase();
    if matches!(tier.as_str(), "" | "locked" | "none" | "blocked") {
        return PolicyResult {
            decision: "block".into(),
            reason: "tier_not_authorized".into(),
            audit: true,
            notify: false,
            chain: false,
            request_required: true,
            request_privileged: false,
            domain,
            source: "local".into(),
        };
    }

    // Chain semantics: `chain` means Ghost Comms chain routing. Ghost routing
    // is NOT wired into the GENYSYS shell yet, so the private pentest surface
    // (sec.rnk-enterprise.us) is fail-closed. Returning chain:true here would
    // load the URL directly and leak the request — an honest block instead.
    let chain_requested = host_matches(&host, &["sec.rnk-enterprise.us"]);
    if chain_requested {
        return PolicyResult {
            decision: "block".into(),
            reason: "chain_unavailable_fail_closed".into(),
            audit: true,
            notify: true,
            chain: false,
            request_required: false,
            request_privileged: false,
            domain,
            source: "local".into(),
        };
    }

    let is_rnk = host_matches(&host, RNK_PRODUCT_HOSTS);

    PolicyResult {
        decision: "allow".into(),
        reason: if is_rnk { "rnk_product_surface".into() } else { "local_policy_allow".into() },
        audit: true,
        notify: false,
        chain: false,
        request_required: false,
        // Privileged context is reserved for RNK product surfaces. Dev builds
        // do NOT get a blanket pass — no dev-silent privilege.
        request_privileged: is_rnk,
        domain,
        source: "local".into(),
    }
}

pub fn block_result(reason: &str, domain: &str) -> PolicyResult {
    PolicyResult {
        decision: "block".into(),
        reason: reason.into(),
        audit: true,
        notify: true,
        chain: false,
        request_required: false,
        request_privileged: false,
        domain: domain.into(),
        source: "local".into(),
    }
}

/// Prefer remote when configured and healthy; otherwise local.
/// Remote failure does NOT open traffic — falls back to local.
/// Local failure → hard block.
pub async fn check_policy(
    url: &str,
    session: &Session,
    lisa_url: &str,
    lisa_key: &Option<String>,
    prefer_remote: bool,
) -> PolicyResult {
    let local = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        evaluate_local(url, session)
    }));

    let local = match local {
        Ok(p) => p,
        Err(_) => return block_result("local_policy_panic_fail_closed", &extract_domain(url)),
    };

    if !prefer_remote || lisa_url.trim().is_empty() {
        return local;
    }

    // Attempt remote P.R.O.T.E.C.T.S. overlay
    match query_remote(url, session, lisa_url, lisa_key).await {
        Ok(remote) => remote,
        Err(_) => {
            // Remote dark — keep local (standalone). Do not fail open.
            let mut p = local;
            if p.reason == "local_policy_allow" {
                p.reason = "local_policy_allow_remote_dark".into();
            }
            p
        }
    }
}

async fn query_remote(
    url: &str,
    session: &Session,
    lisa_url: &str,
    lisa_key: &Option<String>,
) -> Result<PolicyResult, ()> {
    let domain = extract_domain(url);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|_| ())?;

    let endpoint = format!("{}/api/lisa/policy", lisa_url.trim_end_matches('/'));
    let mut req = client
        .post(&endpoint)
        .header("Content-Type", "application/json");

    if let Some(key) = lisa_key {
        req = req.header("X-API-Key", key);
    }

    let body = serde_json::json!({
        "url": url,
        "accessTier": session.access_tier,
        "userId": session.user_id,
        "sessionId": session.session_token,
    });

    let resp = req.json(&body).send().await.map_err(|_| ())?;
    if !resp.status().is_success() {
        return Err(());
    }

    let data: serde_json::Value = resp.json().await.map_err(|_| ())?;
    let decision = data["decision"].as_str().unwrap_or("block").to_string();
    // Remote omitting decision → fail-closed
    Ok(PolicyResult {
        decision: if decision.is_empty() {
            "block".into()
        } else {
            decision
        },
        reason: data["reason"]
            .as_str()
            .unwrap_or("remote_policy")
            .to_string(),
        audit: data["audit"].as_bool().unwrap_or(true),
        notify: data["notify"].as_bool().unwrap_or(false),
        chain: data["chain"].as_bool().unwrap_or(false),
        request_required: data["requestRequired"].as_bool().unwrap_or(false),
        request_privileged: data["requestPrivileged"].as_bool().unwrap_or(false),
        domain,
        source: "remote".into(),
    })
}
