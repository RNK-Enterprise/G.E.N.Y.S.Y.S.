//! Tests for the embedded P.R.O.T.E.C.T.S. policy.
//! Verify bar: unauthenticated → block; authenticated internal axis:// → allow;
//! biosig strings can never authenticate; pentest host stays out of default chrome.

use crate::lisa_policy::evaluate_local;
use crate::{Session, TabContext};

fn unauth() -> Session {
    Session::default()
}

fn agent_session(tier: &str) -> Session {
    Session {
        access_tier: tier.into(),
        user_id: Some("agent".into()),
        session_token: Some("axis-1-test".into()),
        shortcode: None,
        device_verified: false,
    }
}

#[test]
fn unauthenticated_external_navigation_is_blocked() {
    let p = evaluate_local("https://example.com", &unauth());
    assert_eq!(p.decision, "block");
    assert_eq!(p.reason, "unauthenticated");
}

#[test]
fn unauthenticated_rnk_product_navigation_is_blocked() {
    let p = evaluate_local("https://raven.rnk-enterprise.us/dashboard", &unauth());
    assert_eq!(p.decision, "block");
    assert_eq!(p.reason, "unauthenticated");
}

#[test]
fn authenticated_internal_axis_is_allowed() {
    let p = evaluate_local("axis://newtab", &agent_session("agent"));
    assert_eq!(p.decision, "allow");
    assert_eq!(p.reason, "internal_axis_surface");
}

#[test]
fn authenticated_agent_may_open_rnk_product_surface() {
    let p = evaluate_local("https://mail.rnk-enterprise.us/", &agent_session("agent"));
    assert_eq!(p.decision, "allow");
    assert_eq!(p.reason, "rnk_product_surface");
    assert!(p.request_privileged, "RNK product surfaces request Privileged tabs");
}

#[test]
fn ordinary_web_is_allowed_for_agent_tier() {
    let p = evaluate_local("https://duckduckgo.com/?q=test", &agent_session("agent"));
    assert_eq!(p.decision, "allow");
    assert_eq!(p.reason, "local_policy_allow");
    assert!(!p.request_privileged);
}

#[test]
fn locked_tier_never_browses() {
    let p = evaluate_local("https://example.com", &agent_session("locked"));
    assert_eq!(p.decision, "block");
    assert_eq!(p.reason, "tier_not_authorized");
    assert!(p.request_required);
}

#[test]
fn loopback_and_metadata_destinations_are_blocked() {
    for url in [
        "http://localhost:7700/api/layer1/status",
        "http://127.0.0.1:8123/",
        "http://169.254.169.254/latest/meta-data/",
    ] {
        let p = evaluate_local(url, &agent_session("full"));
        assert_eq!(p.decision, "block", "must block {}", url);
        assert_eq!(p.reason, "internal_destination_blocked");
    }
}

#[test]
fn pentest_host_is_fail_closed_without_chain_routing() {
    let p = evaluate_local("https://sec.rnk-enterprise.us/locker", &agent_session("full"));
    assert_eq!(p.decision, "block");
    assert_eq!(p.reason, "chain_unavailable_fail_closed");
    assert!(!p.chain, "chain must never be a silent direct-load");
}

#[test]
fn http_non_loopback_is_blocked() {
    let p = evaluate_local("http://example.com/", &agent_session("agent"));
    assert_eq!(p.decision, "block");
    assert_eq!(p.reason, "scheme_not_allowed");
}

#[test]
fn privileged_context_never_applies_to_plain_web() {
    let p = evaluate_local("https://duckduckgo.com/?q=axis", &agent_session("full"));
    assert!(!p.request_privileged);
}

#[test]
fn tab_context_privileged_only_for_rnk_hosts() {
    // Mirrors determine_context expectations via policy's request_privileged.
    let rnk = evaluate_local("https://echonet.rnk-enterprise.us/", &agent_session("agent"));
    let web = evaluate_local("https://example.com/", &agent_session("agent"));
    assert_eq!(rnk.request_privileged, true);
    assert_eq!(web.request_privileged, false);
    let _ = TabContext::Privileged; // keeps the type imported for future mapping tests
}

#[test]
fn biosig_stub_strings_cannot_authenticate_via_policy() {
    // These must be refused by auth.rs; policy-side they are just unauthenticated URLs.
    for s in ["__biosig__", "__mother_lisa__", "__fido__", "__lisa_handshake__"] {
        let p = evaluate_local(&format!("https://{}", s), &unauth());
        assert_eq!(p.decision, "block");
        assert_eq!(p.reason, "unauthenticated");
    }
}
