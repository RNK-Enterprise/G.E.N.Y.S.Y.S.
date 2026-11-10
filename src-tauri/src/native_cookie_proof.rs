//! Live native-cookie proof, compiled only with `native-cookie-live-proof`.
//!
//! The proof window starts on a loopback HTTPS page, writes the attestation
//! cookie through the same `native_cookie` backend production uses, then walks:
//!
//!   /blank -> /first -> cross-site POST -> /first-done -> /after
//!
//! The companion Node server (scripts/native-cookie-live-proof-server.mjs)
//! asserts the cookie header on `/first`, its absence from `document.cookie`,
//! its delivery on the cross-site POST (`SameSite=None`), and its absence
//! after `/first-done` invokes the real Tauri `attestation_cookie_clear`
//! command. Setting `GENYSYS_COOKIE_PROOF_SAMESITE=Lax` selects the negative
//! mode, where that cross-site delivery must fail.

use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::OnceLock;
use std::time::Duration;
use tauri::window::WindowBuilder;
use tauri::{AppHandle, Manager, Window, WindowUrl};

const LABEL: &str = "native-cookie-proof";
const PROOF_DOMAIN: &str = "localhost";
const PHASE_BLANK: u8 = 0;
const PHASE_COOKIE_SET: u8 = 1;
const PHASE_CLEARED: u8 = 2;
const PHASE_DONE: u8 = 3;

static PHASE: AtomicU8 = AtomicU8::new(PHASE_BLANK);
static BASE: OnceLock<String> = OnceLock::new();
static TOKEN: OnceLock<String> = OnceLock::new();
static SAMESITE: OnceLock<crate::native_cookie::CookieSameSite> = OnceLock::new();
static DOMAIN_PROOF: OnceLock<bool> = OnceLock::new();

pub fn start(app: AppHandle) -> Result<(), String> {
    let base = std::env::var("GENYSYS_COOKIE_PROOF_URL")
        .map_err(|_| "GENYSYS_COOKIE_PROOF_URL is required".to_string())?;
    let token = std::env::var("GENYSYS_COOKIE_PROOF_TOKEN")
        .map_err(|_| "GENYSYS_COOKIE_PROOF_TOKEN is required".to_string())?;
    let same_site = match std::env::var("GENYSYS_COOKIE_PROOF_SAMESITE") {
        Ok(value) if value.eq_ignore_ascii_case("none") => {
            crate::native_cookie::CookieSameSite::None
        }
        Ok(value) if value.eq_ignore_ascii_case("lax") => crate::native_cookie::CookieSameSite::Lax,
        Ok(value) => return Err(format!("invalid proof SameSite: {value}")),
        Err(std::env::VarError::NotPresent) => crate::native_cookie::CookieSameSite::None,
        Err(_) => return Err("proof SameSite is not valid UTF-8".into()),
    };
    if url::Url::parse(&format!("{base}/blank")).is_err() {
        return Err("invalid proof URL".into());
    }
    let domain_proof = std::env::var("GENYSYS_COOKIE_PROOF_DOMAIN_PROOF")
        .map(|value| value == "1")
        .unwrap_or(false);
    DOMAIN_PROOF
        .set(domain_proof)
        .map_err(|_| "proof already started".to_string())?;
    BASE.set(base.clone())
        .map_err(|_| "proof already started".to_string())?;
    TOKEN
        .set(token)
        .map_err(|_| "proof already started".to_string())?;
    SAMESITE
        .set(same_site)
        .map_err(|_| "proof already started".to_string())?;

    // Linux cannot add a temporary certificate to the system trust store from
    // the proof script, so load a plain-HTTP boot page, let the proof-only web
    // context ignore TLS errors, then open the HTTPS probe. Production never
    // compiles this feature and keeps WebKitGTK's normal certificate policy.
    #[cfg(target_os = "linux")]
    let initial: url::Url = std::env::var("GENYSYS_COOKIE_PROOF_START_URL")
        .map_err(|_| "GENYSYS_COOKIE_PROOF_START_URL is required on Linux".to_string())?
        .parse()
        .map_err(|e| format!("invalid initial proof URL: {e}"))?;
    #[cfg(not(target_os = "linux"))]
    let initial: url::Url = format!("{base}/{}", if domain_proof { "domain" } else { "blank" })
        .parse()
        .map_err(|e| format!("invalid proof URL: {e}"))?;
    // The logout proof invokes the real Tauri command from the external
    // localhost page. Grant IPC only to this proof window and only for HTTPS
    // localhost; production builds never compile this module. The production-
    // domain mode invokes Rust directly and needs no page IPC.
    if !domain_proof {
        use tauri::scope::ipc::RemoteDomainAccessScope;
        app.ipc_scope().configure_remote_access(
            RemoteDomainAccessScope::new("localhost")
                .allow_on_scheme("https")
                .add_window(LABEL)
                .enable_tauri_api(),
        );
    }
    let builder = WindowBuilder::new(&app, LABEL, WindowUrl::External(initial))
        .title("GENYSYS native cookie proof")
        .inner_size(480.0, 320.0)
        .visible(false);
    #[cfg(target_os = "windows")]
    let builder = builder.additional_browser_args(
        "--ignore-certificate-errors --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection",
    );
    let _window = builder.build().map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    {
        // The boot page is HTTP, so no certificate is needed before the TLS
        // policy is set. with_webview dispatches to the UI loop; configure and
        // navigate from a worker so setup does not block that loop.
        let window = _window.clone();
        std::thread::spawn(move || {
            use webkit2gtk::{WebContextExt, WebViewExt};
            if DOMAIN_PROOF.get().copied().unwrap_or(false) {
                return;
            }
            if let Err(error) = window.with_webview(|webview| {
                if let Some(context) = webview.inner().context() {
                    context.set_tls_errors_policy(webkit2gtk::TLSErrorsPolicy::Ignore);
                }
            }) {
                fail(&window, &format!("could not configure proof TLS: {error}"));
                return;
            }
            navigate(&window, "/blank");
        });
    }

    if let Some(main) = app.get_window("main") {
        let _ = main.hide();
    }
    eprintln!(
        "[native-cookie-proof] window armed at {base}/{} ({same_site:?})",
        if domain_proof { "domain" } else { "blank" }
    );

    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(25));
        if PHASE.load(Ordering::SeqCst) != PHASE_DONE {
            eprintln!("[native-cookie-proof] FAIL: timeout");
            app.exit(2);
        }
    });
    Ok(())
}

pub fn on_page_load(window: &Window, url: &str) {
    if window.label() != LABEL {
        return;
    }
    let Ok(url) = url::Url::parse(url) else {
        return;
    };
    if DOMAIN_PROOF.get().copied().unwrap_or(false) {
        if url.path() == "/domain" {
            run_production_domain_proof(window);
        }
        return;
    }
    match url.path() {
        "/blank" => {
            if PHASE
                .compare_exchange(
                    PHASE_BLANK,
                    PHASE_COOKIE_SET,
                    Ordering::SeqCst,
                    Ordering::SeqCst,
                )
                .is_err()
            {
                return;
            }
            let Some(token) = TOKEN.get().cloned() else {
                fail(window, "proof token missing");
                return;
            };
            let Some(same_site) = SAMESITE.get().copied() else {
                fail(window, "proof SameSite missing");
                return;
            };
            // Cookie-manager completion handlers run on the UI loop. Do not
            // block that loop waiting for them from on_page_load.
            let window = window.clone();
            std::thread::spawn(move || {
                if let Err(error) = crate::native_cookie::set_cookie_for_domain_with_samesite(
                    &window,
                    &token,
                    60,
                    PROOF_DOMAIN,
                    same_site,
                ) {
                    fail(&window, &format!("set_cookie failed: {error}"));
                    return;
                }
                eprintln!("[native-cookie-proof] cookie set; requesting /first");
                navigate(&window, "/first");
            });
        }
        "/first-done" => {
            if PHASE
                .compare_exchange(
                    PHASE_COOKIE_SET,
                    PHASE_CLEARED,
                    Ordering::SeqCst,
                    Ordering::SeqCst,
                )
                .is_err()
            {
                return;
            }
            // The /first-done page invokes the real Tauri
            // `attestation_cookie_clear` command over IPC. Reaching /after is
            // the proof's signal that the command round-trip completed; the
            // server check then verifies the cookie is actually gone.
            eprintln!("[native-cookie-proof] logout command requested by page");
        }
        "/after" => {
            if PHASE
                .compare_exchange(
                    PHASE_CLEARED,
                    PHASE_DONE,
                    Ordering::SeqCst,
                    Ordering::SeqCst,
                )
                .is_err()
            {
                return;
            }
            eprintln!("[native-cookie-proof] final page loaded; exiting");
            let app = window.app_handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(1_200));
                app.exit(0);
            });
        }
        _ => {}
    }
}

fn run_production_domain_proof(window: &Window) {
    if std::env::var("GENYSYS_COOKIE_PROOF_DOMAIN").is_ok() {
        fail(
            window,
            "production-domain mode must not set GENYSYS_COOKIE_PROOF_DOMAIN",
        );
        return;
    }
    let Some(token) = TOKEN.get().cloned() else {
        fail(window, "proof token missing");
        return;
    };
    let Some(report_path) = std::env::var("GENYSYS_COOKIE_PROOF_DOMAIN_REPORT").ok() else {
        fail(window, "domain proof report path missing");
        return;
    };
    let window = window.clone();
    std::thread::spawn(move || {
        let domain = crate::native_cookie::COOKIE_DOMAIN;
        let mut seeded = false;
        let mut same_site_none = false;
        let mut clear_completed = false;
        let mut cleared = false;
        let mut error = None;
        if let Err(value) = crate::native_cookie::set_cookie_for_domain(&window, &token, 60, domain)
        {
            error = Some(value);
        } else {
            match crate::native_cookie::cookie_probe_for_domain(&window, domain) {
                Ok((present, none)) => {
                    seeded = present;
                    same_site_none = none;
                }
                Err(value) => error = Some(value),
            }
            if seeded {
                match crate::tab_windows_webkit::attestation_cookie_clear(window.clone()) {
                    Ok(()) => {
                        clear_completed = true;
                        for _ in 0..20 {
                            match crate::native_cookie::cookie_probe_for_domain(&window, domain) {
                                Ok((present, _)) if !present => {
                                    cleared = true;
                                    break;
                                }
                                _ => std::thread::sleep(Duration::from_millis(100)),
                            }
                        }
                    }
                    Err(value) => error = Some(value),
                }
            }
        }
        let pass = seeded && same_site_none && clear_completed && cleared;
        let report = serde_json::json!({
            "mode": "production-domain",
            "domain": domain,
            "same_site": "None",
            "pass": pass,
            "checks": {
                "cookie_seeded": seeded,
                "cookie_same_site_none": same_site_none,
                "clear_command_completed": clear_completed,
                "cookie_cleared": cleared
            },
            "error": error
        });
        if let Err(value) = std::fs::write(
            &report_path,
            serde_json::to_vec_pretty(&report).unwrap_or_default(),
        ) {
            eprintln!("[native-cookie-proof] FAIL: report write: {value}");
            PHASE.store(PHASE_DONE, Ordering::SeqCst);
            window.app_handle().exit(2);
            return;
        }
        eprintln!("[native-cookie-proof] production-domain report: {report}");
        PHASE.store(PHASE_DONE, Ordering::SeqCst);
        window.app_handle().exit(if pass { 0 } else { 2 });
    });
}

fn navigate(window: &Window, path: &str) {
    let Some(base) = BASE.get() else {
        fail(window, "proof base URL missing");
        return;
    };
    let target = format!("{base}{path}");
    let Ok(literal) = serde_json::to_string(&target) else {
        fail(window, "could not encode proof URL");
        return;
    };
    if let Err(error) = window.eval(&format!("window.location.href={literal};")) {
        fail(window, &format!("navigation failed: {error}"));
    }
}

fn fail(window: &Window, message: &str) {
    eprintln!("[native-cookie-proof] FAIL: {message}");
    PHASE.store(PHASE_DONE, Ordering::SeqCst);
    window.app_handle().exit(2);
}
