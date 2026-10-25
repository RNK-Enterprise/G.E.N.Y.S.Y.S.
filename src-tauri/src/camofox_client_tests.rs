//! Contract-shape tests for the Camofox loopback boundary.

use crate::camofox_client::{
    validate_action_target, validate_destination, validate_loopback_origin, validate_path_segment,
    validate_scroll_arguments, CamofoxTab, CamofoxVncStatus,
};
use crate::camofox_client_navigate::{
    parse_navigate_result, validate_loopback_callback, CamofoxNavigateHop,
};
use serde_json::json;

#[test]
fn vnc_status_uses_the_service_wire_names() {
    let value = json!({
        "enabled": true,
        "running": true,
        "novncPort": 6080,
        "path": "/vnc.html"
    });
    let parsed: CamofoxVncStatus = serde_json::from_value(value).expect("vnc status");
    assert!(parsed.enabled);
    assert!(parsed.running);
    assert_eq!(parsed.novnc_port, 6080);
    assert_eq!(parsed.path, "/vnc.html");
}

#[test]
fn tab_response_uses_the_service_tab_id_and_url() {
    let value = json!({ "tabId": "abc-123", "url": "https://example.com/" });
    let parsed: CamofoxTab = serde_json::from_value(value).expect("tab");
    assert_eq!(parsed.tab_id, "abc-123");
    assert_eq!(parsed.url, "https://example.com/");
}

#[test]
fn loopback_origin_rejects_non_loopback_and_non_origin_values() {
    assert!(validate_loopback_origin("http://127.0.0.1:9377").is_ok());
    assert!(validate_loopback_origin("http://localhost:9377").is_ok());
    for value in [
        "https://example.com",
        "ftp://127.0.0.1:9377",
        "http://127.0.0.1:9377/path",
        "http://127.0.0.1:9377/?x=1",
    ] {
        assert!(validate_loopback_origin(value).is_err(), "{value}");
    }
}

#[test]
fn destination_accepts_http_s_and_rejects_ambiguous_targets() {
    assert!(validate_destination("https://example.com/path").is_ok());
    assert!(validate_destination("http://127.0.0.1:9377").is_ok());
    for value in ["", "javascript:alert(1)", "https:///missing-host"] {
        assert!(validate_destination(value).is_err(), "{value}");
    }
}

#[test]
fn path_segment_allows_service_ids_without_path_injection() {
    assert_eq!(validate_path_segment("tab-1._x").unwrap(), "tab-1._x");
    for value in ["", "tab/1", "tab?x=1", "tab%2F1"] {
        assert!(validate_path_segment(value).is_err(), "{value}");
    }
}

#[test]
fn actions_require_bounded_targets_and_scroll_arguments() {
    assert!(validate_action_target(Some("e1"), None, "missing").is_ok());
    assert!(validate_action_target(None, Some("button.submit"), "missing").is_ok());
    assert_eq!(
        validate_action_target(Some(" "), None, "missing"),
        Err("missing".into())
    );
    assert!(validate_scroll_arguments("down", 500).is_ok());
    assert!(validate_scroll_arguments("diagonal", 500).is_err());
    assert!(validate_scroll_arguments("down", 10_001).is_err());
}

#[test]
fn policy_callback_must_be_loopback_check_path() {
    assert!(validate_loopback_callback("http://127.0.0.1:9/camofox/policy/check").is_ok());
    assert!(validate_loopback_callback("http://example.com/camofox/policy/check").is_err());
    assert!(validate_loopback_callback("http://127.0.0.1:9/other").is_err());
}

#[test]
fn navigate_result_requires_guard_hops_when_requested() {
    let missing = parse_navigate_result(json!({ "url": "https://example.com/", "navigationOk": true }), true);
    assert_eq!(missing, Err("camofox_redirect_guard_missing".into()));

    let ok = parse_navigate_result(
        json!({
            "url": "https://example.com/",
            "navigationOk": true,
            "hops": [{
                "url": "https://example.com/",
                "decision": "allow",
                "reason": "policy_ok",
                "hop": 0
            }]
        }),
        true,
    )
    .expect("guarded navigate");
    assert_eq!(ok.url, "https://example.com/");
    assert_eq!(
        ok.hops,
        vec![CamofoxNavigateHop {
            url: "https://example.com/".into(),
            decision: "allow".into(),
            reason: "policy_ok".into(),
            hop: 0,
        }]
    );
}
