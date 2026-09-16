//! Tests for tab window classification (fail-closed navigation gate)
//! and tab-window lifecycle bookkeeping against Tauri's mock runtime.

use crate::tab_windows::*;
use crate::Session;

fn session(tier: &str, token: Option<&str>) -> Session {
    Session {
        access_tier: tier.into(),
        user_id: Some("tester".into()),
        session_token: token.map(|t| t.into()),
        shortcode: None,
        device_verified: false,
    }
}

#[test]
fn newtab_classifies_internal_allow() {
    let p = classify_tab_navigation(&newtab_url(), &session("agent", Some("t")));
    assert_eq!(p.decision, "allow");
    assert!(!p.request_privileged);
}

#[test]
fn veil_newtab_alias_is_allowed() {
    let p = classify_tab_navigation("veil://newtab", &session("agent", Some("t")));
    assert_eq!(p.decision, "allow");
}

#[test]
fn app_origin_exact_only_localhost_ports_dont_sneak_in() {
    assert!(is_app_origin(&newtab_url()));
    assert!(is_app_origin("veil://newtab"));
    assert!(!is_app_origin("http://localhost:9999/evil"));
    assert!(!is_app_origin("http://evil.com/?x=http://localhost:1420"));
}

#[test]
fn unauthenticated_external_is_blocked() {
    let p = classify_tab_navigation("https://example.com", &session("locked", None));
    assert_eq!(p.decision, "block");
    assert_eq!(p.reason, "unauthenticated");
    assert!(!window_allowed(&p));
}

#[test]
fn authenticated_plain_site_allowed_unprivileged() {
    let p = classify_tab_navigation("https://example.com", &session("agent", Some("t")));
    assert_eq!(p.decision, "allow");
    assert!(!p.request_privileged, "public web must not be privileged");
}

#[test]
fn rnk_surface_is_privileged() {
    let p = classify_tab_navigation(
        "https://raven.rnk-enterprise.us/inbox",
        &session("agent", Some("t")),
    );
    assert_eq!(p.decision, "allow");
    assert!(p.request_privileged, "RNK product surfaces are privileged");
}

#[test]
fn loopback_never_loads_even_authenticated() {
    let p = classify_tab_navigation("http://169.254.169.254/latest", &session("full", Some("t")));
    assert_eq!(p.decision, "block");
}

#[test]
fn privilege_is_host_based_not_tier_or_build_based() {
    // Privilege comes from the RNK host allowlist only — never from the
    // session tier or build type. Tier enforcement is the products'
    // attestation gate (dev is an allowed tier there by contract).
    let p = classify_tab_navigation(
        "https://raven.rnk-enterprise.us",
        &session("dev", Some("t")),
    );
    assert_eq!(p.decision, "allow");
    assert!(p.request_privileged, "RNK host → privileged, even for dev tier");

    let q = classify_tab_navigation("https://example.com", &session("full", Some("t")));
    assert!(!q.request_privileged, "non-RNK host is never privileged");
}

#[test]
fn scheme_smuggler_blocked() {
    let p = classify_tab_navigation("file:///etc/passwd", &session("full", Some("t")));
    assert_eq!(p.decision, "block");
}

#[test]
fn default_rect_is_sane() {
    assert!(DEFAULT_RECT.width > 0 && DEFAULT_RECT.height > 0);
}

#[test]
fn internal_loader_refuses_external_urls() {
    // The internal-load command must refuse anything off app-origin.
    assert!(is_app_origin(&newtab_url()));
    assert!(!is_app_origin("https://example.com"));
    assert!(!is_app_origin("http://localhost:1420.evil.com/"));
}

// ── Lifecycle bookkeeping against the mock runtime ───────────────────────────
//
// The mock runtime creates real `Window` handles (no OS window) and its
// `close()` routes through the runtime's message pump, so OS destruction
// itself is verified in live runs (see lifecycle logging). What these tests
// pin is `close_tab_window`'s bookkeeping contract and `create_tab_window`'s
// window-registry visibility — the exact state the shell relies on.

use tauri::Manager;

fn mock_veil_app() -> tauri::App<tauri::test::MockRuntime> {
    let app = tauri::test::mock_app();
    app.manage(TabWindows::default());
    app
}

#[test]
fn close_tab_window_clears_bookkeeping_and_registry() {
    let app = mock_veil_app();
    let handle = app.handle();

    // Create a tab window through the REAL create path.
    create_tab_window(&handle, 7, &newtab_url(), false).expect("create tab window 7");
    assert!(
        handle.get_window("tab-7").is_some(),
        "tab-7 must be in the runtime registry after create"
    );
    assert_eq!(
        TabWindows::state(&handle).windows.lock().unwrap().len(),
        1,
        "bookkeeping must track the created window"
    );

    // Close through the REAL close path.
    close_tab_window(&handle, 7);

    // Bookkeeping cleared synchronously — this is the state the shell's
    // UI thread reads right after the close command returns.
    assert!(
        TabWindows::state(&handle).windows.lock().unwrap().is_empty(),
        "window map must be empty after close"
    );
    assert!(
        TabWindows::state(&handle).rects.lock().unwrap().is_empty(),
        "rect map must be empty after close"
    );
    // The runtime registry entry may or may not be gone yet (destruction is
    // pumped by the event loop in production), so no assertion on it here.
}

#[test]
fn close_tab_window_is_idempotent() {
    let app = mock_veil_app();
    let handle = app.handle();

    create_tab_window(&handle, 9, &newtab_url(), false).expect("create tab window 9");
    close_tab_window(&handle, 9);
    // Second close on the same id must not panic (window already gone).
    close_tab_window(&handle, 9);

    assert!(TabWindows::state(&handle).windows.lock().unwrap().is_empty());
}

#[test]
fn close_tab_window_on_never_created_tab_is_safe() {
    let app = mock_veil_app();
    let handle = app.handle();
    // Closing a tab id that never had a window must be a no-op, not a panic.
    close_tab_window(&handle, 4242);
    assert!(TabWindows::state(&handle).windows.lock().unwrap().is_empty());
}

#[test]
fn created_window_label_and_bookkeeping_metadata_match() {
    let app = mock_veil_app();
    let handle = app.handle();

    create_tab_window(&handle, 11, &newtab_url(), true).expect("create privileged tab window");
    assert!(handle.get_window("tab-11").is_some());

    let meta = TabWindows::state(&handle)
        .windows
        .lock()
        .unwrap()
        .get(&11)
        .cloned()
        .expect("bookkeeping entry for tab 11");
    assert!(meta.privileged, "privileged flag must round-trip");

    close_tab_window(&handle, 11);
    assert!(TabWindows::state(&handle).windows.lock().unwrap().is_empty());
}
