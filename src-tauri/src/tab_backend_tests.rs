//! Refusal and boundary tests for tab backend selection.

use crate::tab_backend::TabBackendKind;

#[test]
fn empty_and_webkit_aliases_select_existing_surface() {
    for value in ["", "webkit", "WebKitGTK"] {
        let backend = TabBackendKind::from_config_value(value).expect("webkit alias");
        assert_eq!(backend, TabBackendKind::Webkit);
        assert!(backend.has_native_surface());
        assert_eq!(backend.as_str(), "webkit");
        assert_eq!(backend.unavailable_reason(), "");
    }
}

#[test]
fn camofox_is_explicit_and_is_not_routed_through_webkit() {
    let backend = TabBackendKind::from_config_value("camofox").expect("camofox selector");
    assert_eq!(backend, TabBackendKind::Camofox);
    assert!(!backend.has_native_surface());
    assert_eq!(backend.as_str(), "camofox");
    assert_eq!(
        backend.unavailable_reason(),
        "camofox_surface_owned_by_camofox_backend"
    );
}

#[test]
fn unknown_backend_is_refused_without_fallback() {
    let result = TabBackendKind::from_config_value("chromium");
    assert_eq!(result, Err("unsupported_tab_backend:chromium".into()));
}

#[test]
fn whitespace_is_normalized_but_unknown_values_remain_unknown() {
    let result = TabBackendKind::from_config_value("  unknown  ");
    assert_eq!(result, Err("unsupported_tab_backend:unknown".into()));
}
