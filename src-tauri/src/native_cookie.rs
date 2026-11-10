//! Native attestation-cookie storage for each supported webview engine.
//!
//! Split from the tab-window module to keep both files under the 500-line cap.
//! Every backend writes the same `genysys_attest` cookie domain/path/flags;
//! unsupported platforms fail closed with `native_cookie_unsupported`.

use tauri::Window;

/// Production cookie domain. The live-proof harness uses an explicit loopback
/// domain instead so it never touches a real RNK cookie jar.
pub(crate) const COOKIE_DOMAIN: &str = ".rnk-enterprise.us";

/// SameSite value used by the live proof. Production always uses `None`.
#[cfg_attr(not(feature = "native-cookie-live-proof"), allow(dead_code))]
#[derive(Clone, Copy, Debug)]
pub(crate) enum CookieSameSite {
    None,
    Lax,
}

#[allow(dead_code)]
pub(crate) fn set_cookie(window: &Window, value: &str, max_age_secs: i64) -> Result<(), String> {
    set_cookie_for_domain(window, value, max_age_secs, COOKIE_DOMAIN)
}

pub(crate) fn set_cookie_for_domain(
    window: &Window,
    value: &str,
    max_age_secs: i64,
    domain: &str,
) -> Result<(), String> {
    set_cookie_for_domain_with_samesite(window, value, max_age_secs, domain, CookieSameSite::None)
}

pub(crate) fn clear_cookie(window: &Window) -> Result<(), String> {
    #[cfg(feature = "native-cookie-live-proof")]
    if let Ok(domain) = std::env::var("GENYSYS_COOKIE_PROOF_DOMAIN") {
        if !domain.is_empty() {
            // The proof must invoke the real Tauri command, whose production
            // wrapper uses the RNK domain. Redirect only this guarded build to
            // the loopback proof jar.
            eprintln!("[native-cookie-proof] clear domain {domain}");
            return clear_cookie_for_domain(window, &domain);
        }
    }
    clear_cookie_for_domain(window, COOKIE_DOMAIN)
}

#[cfg(target_os = "linux")]
pub(crate) fn set_cookie_for_domain_with_samesite(
    window: &Window,
    value: &str,
    max_age_secs: i64,
    domain: &str,
    same_site: CookieSameSite,
) -> Result<(), String> {
    use webkit2gtk::{CookieManagerExt, WebContextExt, WebViewExt};
    let value = value.to_string();
    let domain = domain.to_string();
    // add_cookie is asynchronous on the GTK main loop. Wait for its callback
    // here so the arming page cannot navigate before the cookie exists.
    let (tx, rx) = std::sync::mpsc::channel::<bool>();
    window
        .with_webview(move |webview| {
            let view = webview.inner();
            let Some(context) = view.context() else {
                let _ = tx.send(false);
                return;
            };
            let Some(manager) = context.cookie_manager() else {
                let _ = tx.send(false);
                return;
            };
            let mut cookie = soup::Cookie::new(
                crate::attestation::COOKIE_NAME,
                &value,
                &domain,
                "/",
                max_age_secs as i32,
            );
            cookie.set_secure(true);
            cookie.set_http_only(true);
            cookie.set_same_site_policy(match same_site {
                CookieSameSite::None => soup::SameSitePolicy::None,
                CookieSameSite::Lax => soup::SameSitePolicy::Lax,
            });
            manager.add_cookie(
                &mut cookie,
                None::<&webkit2gtk::gio::Cancellable>,
                move |result| {
                    let _ = tx.send(result.is_ok());
                },
            );
        })
        .map_err(|e| e.to_string())?;
    match rx.recv_timeout(std::time::Duration::from_secs(2)) {
        Ok(true) => Ok(()),
        Ok(false) => Err("native_cookie_set_failed".into()),
        Err(_) => Err("native_cookie_set_timeout".into()),
    }
}

#[cfg(target_os = "linux")]
pub(crate) fn clear_cookie_for_domain(window: &Window, domain: &str) -> Result<(), String> {
    use webkit2gtk::{CookieManagerExt, WebContextExt, WebViewExt};
    let domain = domain.to_string();
    window
        .with_webview(move |webview| {
            let view = webview.inner();
            if let Some(context) = view.context() {
                if let Some(manager) = context.cookie_manager() {
                    let mut cookie =
                        soup::Cookie::new(crate::attestation::COOKIE_NAME, "", &domain, "/", 0);
                    manager.add_cookie(&mut cookie, None::<&webkit2gtk::gio::Cancellable>, |_| {});
                }
            }
        })
        .map_err(|e| e.to_string())
}

#[cfg(all(target_os = "linux", feature = "native-cookie-live-proof"))]
pub(crate) fn cookie_probe_for_domain(
    window: &Window,
    domain: &str,
) -> Result<(bool, bool), String> {
    use webkit2gtk::{CookieManagerExt, WebContextExt, WebViewExt};
    let (tx, rx) = std::sync::mpsc::channel::<(bool, bool)>();
    let domain = domain.to_string();
    window
        .with_webview(move |webview| {
            let view = webview.inner();
            let Some(context) = view.context() else {
                let _ = tx.send((false, false));
                return;
            };
            let Some(manager) = context.cookie_manager() else {
                let _ = tx.send((false, false));
                return;
            };
            let uri = format!("https://{}/", domain.trim_start_matches('.'));
            manager.cookies(&uri, None::<&webkit2gtk::gio::Cancellable>, move |result| {
                let mut present = false;
                let mut same_site_none = false;
                if let Ok(mut cookies) = result {
                    for cookie in cookies.iter_mut() {
                        let name = cookie.name().map(|value| value.to_string());
                        let cookie_domain = cookie.domain().map(|value| value.to_string());
                        if name.as_deref() == Some(crate::attestation::COOKIE_NAME)
                            && cookie_domain
                                .as_deref()
                                .map(|value| value.trim_start_matches('.'))
                                == Some(domain.trim_start_matches('.'))
                        {
                            present = true;
                            same_site_none =
                                cookie.same_site_policy() == soup::SameSitePolicy::None;
                            break;
                        }
                    }
                }
                let _ = tx.send((present, same_site_none));
            });
        })
        .map_err(|e| e.to_string())?;
    rx.recv_timeout(std::time::Duration::from_secs(2))
        .map_err(|_| "native_cookie_read_timeout".into())
}

#[cfg(all(not(target_os = "linux"), feature = "native-cookie-live-proof"))]
pub(crate) fn cookie_probe_for_domain(
    _window: &Window,
    _domain: &str,
) -> Result<(bool, bool), String> {
    Err("native_cookie_read_unsupported".into())
}

#[cfg(target_os = "windows")]
pub(crate) fn set_cookie_for_domain_with_samesite(
    window: &Window,
    value: &str,
    max_age_secs: i64,
    domain: &str,
    same_site: CookieSameSite,
) -> Result<(), String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_2, COREWEBVIEW2_COOKIE_SAME_SITE_KIND_LAX,
        COREWEBVIEW2_COOKIE_SAME_SITE_KIND_NONE,
    };
    use windows::core::{Interface, HSTRING};
    use windows::Win32::Foundation::BOOL;

    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    let value = value.to_string();
    let domain = domain.to_string();
    window
        .with_webview(move |webview| {
            let result = (|| -> Result<(), String> {
                let name = HSTRING::from(crate::attestation::COOKIE_NAME);
                let value = HSTRING::from(value.as_str());
                let domain = HSTRING::from(domain.as_str());
                let path = HSTRING::from("/");
                unsafe {
                    let controller = webview.controller();
                    let core: ICoreWebView2_2 = controller
                        .CoreWebView2()
                        .map_err(|e| e.to_string())?
                        .cast()
                        .map_err(|e| e.to_string())?;
                    let manager = core.CookieManager().map_err(|e| e.to_string())?;
                    let cookie = manager
                        .CreateCookie(&name, &value, &domain, &path)
                        .map_err(|e| e.to_string())?;
                    let expires = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs_f64())
                        .unwrap_or(0.0)
                        + max_age_secs as f64;
                    cookie.SetExpires(expires).map_err(|e| e.to_string())?;
                    cookie.SetIsHttpOnly(BOOL(1)).map_err(|e| e.to_string())?;
                    cookie.SetIsSecure(BOOL(1)).map_err(|e| e.to_string())?;
                    cookie
                        .SetSameSite(match same_site {
                            CookieSameSite::None => COREWEBVIEW2_COOKIE_SAME_SITE_KIND_NONE,
                            CookieSameSite::Lax => COREWEBVIEW2_COOKIE_SAME_SITE_KIND_LAX,
                        })
                        .map_err(|e| e.to_string())?;
                    manager
                        .AddOrUpdateCookie(&cookie)
                        .map_err(|e| e.to_string())?;
                }
                Ok(())
            })();
            let _ = tx.send(result);
        })
        .map_err(|e| e.to_string())?;
    match rx.recv_timeout(std::time::Duration::from_secs(2)) {
        Ok(Ok(())) => Ok(()),
        Ok(Err(e)) => Err(e),
        Err(_) => Err("native_cookie_set_timeout".into()),
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn clear_cookie_for_domain(window: &Window, domain: &str) -> Result<(), String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_2;
    use windows::core::{Interface, HSTRING};
    let domain = domain.to_string();
    window
        .with_webview(move |webview| unsafe {
            let Ok(base) = webview.controller().CoreWebView2() else {
                return;
            };
            let Ok(core) = base.cast::<ICoreWebView2_2>() else {
                return;
            };
            let Ok(manager) = core.CookieManager() else {
                return;
            };
            let name = HSTRING::from(crate::attestation::COOKIE_NAME);
            let domain = HSTRING::from(domain.as_str());
            let path = HSTRING::from("/");
            let _ = manager.DeleteCookiesWithDomainAndPath(&name, &domain, &path);
        })
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn macos_cookie(
    domain: &str,
    value: &str,
    max_age_secs: i64,
    same_site: CookieSameSite,
) -> Result<cocoa::base::id, String> {
    use cocoa::base::{id, nil};
    use objc::{class, msg_send, sel, sel_impl};
    use std::ffi::CString;

    unsafe {
        let nsstring = |text: &str| -> Result<id, String> {
            let bytes =
                CString::new(text).map_err(|_| "native_cookie_value_invalid".to_string())?;
            let value: id = msg_send![class!(NSString), stringWithUTF8String: bytes.as_ptr()];
            if value == nil {
                Err("native_cookie_string_failed".into())
            } else {
                Ok(value)
            }
        };
        // NSHTTPCookie property dictionaries cannot carry HttpOnly. Parsing a
        // Set-Cookie header preserves Secure, HttpOnly, and SameSite=None.
        let same_site = match same_site {
            CookieSameSite::None => "None",
            CookieSameSite::Lax => "Lax",
        };
        let header = nsstring(&format!(
            "{}={}; Domain={}; Path=/; Secure; HttpOnly; SameSite={same_site}; Max-Age={}",
            crate::attestation::COOKIE_NAME,
            value,
            domain,
            max_age_secs,
        ))?;
        let key = nsstring("Set-Cookie")?;
        let headers: id = msg_send![class!(NSDictionary), dictionaryWithObject: header forKey: key];
        let url = nsstring(&format!("https://{}/", domain.trim_start_matches('.')))?;
        let parsed_url: id = msg_send![class!(NSURL), URLWithString: url];
        if parsed_url == nil {
            return Err("native_cookie_url_failed".into());
        }
        let cookies: id = msg_send![class!(NSHTTPCookie), cookiesWithResponseHeaderFields: headers forURL: parsed_url];
        if cookies == nil {
            return Err("native_cookie_parse_failed".into());
        }
        let count: usize = msg_send![cookies, count];
        if count == 0 {
            return Err("native_cookie_parse_failed".into());
        }
        let cookie: id = msg_send![cookies, objectAtIndex: 0usize];
        if cookie == nil {
            Err("native_cookie_parse_failed".into())
        } else {
            Ok(cookie)
        }
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn set_cookie_for_domain_with_samesite(
    window: &Window,
    value: &str,
    max_age_secs: i64,
    domain: &str,
    same_site: CookieSameSite,
) -> Result<(), String> {
    use cocoa::base::{id, nil};
    use objc::{class, msg_send, sel, sel_impl};

    let (tx, rx) = std::sync::mpsc::channel::<bool>();
    let value = value.to_string();
    let domain = domain.to_string();
    window
        .with_webview(move |webview| {
            let result = (|| -> Result<(), String> {
                let cookie = macos_cookie(&domain, &value, max_age_secs, same_site)?;
                unsafe {
                    let store: id = msg_send![webview.inner(), websiteDataStore];
                    if store == nil {
                        return Err("native_cookie_store_missing".into());
                    }
                    let cookie_store: id = msg_send![store, httpCookieStore];
                    if cookie_store == nil {
                        return Err("native_cookie_store_missing".into());
                    }
                    let done = tx.clone();
                    let block = block::ConcreteBlock::new(move || {
                        let _ = done.send(true);
                    })
                    .copy();
                    let handler = &*block as *const _ as id;
                    let _: () =
                        msg_send![cookie_store, setCookie: cookie completionHandler: handler];
                }
                Ok(())
            })();
            if result.is_err() {
                let _ = tx.send(false);
            }
        })
        .map_err(|e| e.to_string())?;
    match rx.recv_timeout(std::time::Duration::from_secs(2)) {
        Ok(true) => Ok(()),
        Ok(false) => Err("native_cookie_set_failed".into()),
        Err(_) => Err("native_cookie_set_timeout".into()),
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn clear_cookie_for_domain(window: &Window, domain: &str) -> Result<(), String> {
    use cocoa::base::{id, nil};
    use objc::{class, msg_send, sel, sel_impl};
    let domain = domain.to_string();

    window
        .with_webview(move |webview| {
            if let Ok(cookie) = macos_cookie(&domain, "", 0, CookieSameSite::None) {
                unsafe {
                    let store: id = msg_send![webview.inner(), websiteDataStore];
                    if store != nil {
                        let cookie_store: id = msg_send![store, httpCookieStore];
                        if cookie_store != nil {
                            let _: () = msg_send![cookie_store, deleteCookie: cookie completionHandler: nil];
                        }
                    }
                }
            }
        })
        .map_err(|e| e.to_string())
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
pub(crate) fn set_cookie_for_domain_with_samesite(
    _window: &Window,
    _value: &str,
    _max_age_secs: i64,
    _domain: &str,
    _same_site: CookieSameSite,
) -> Result<(), String> {
    Err("native_cookie_unsupported".into())
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
pub(crate) fn clear_cookie_for_domain(_window: &Window, _domain: &str) -> Result<(), String> {
    Err("native_cookie_unsupported".into())
}
