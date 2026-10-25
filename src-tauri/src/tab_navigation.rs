//! Policy-gated navigation for the logical GENYSYS tab.

use crate::{AppHandle, AppState, PolicyResult, State, TabContext, Window};

const PRIVILEGED_PRODUCT_DOMAINS: &[&str] = &[
    "rnk-enterprise.us",
    "mail.rnk-enterprise.us",
    "demo.rnk-enterprise.us",
    "app.rnk-enterprise.us",
    "localhost",
    "127.0.0.1",
];

/// Navigate through P.R.O.T.E.C.T.S. and then the configured content backend.
#[tauri::command]
pub async fn navigate_tab(
    tab_id: u32,
    url: String,
    state: State<'_, AppState>,
    window: Window,
    app: AppHandle,
) -> Result<PolicyResult, String> {
    let (policy_url, policy_key, session, prefer_remote) = {
        let au = state.policy_url.lock().map_err(|e| e.to_string())?.clone();
        let lk = state.policy_key.lock().map_err(|e| e.to_string())?.clone();
        let s = state.session.lock().map_err(|e| e.to_string())?.clone();
        let pr = *state.prefer_remote.lock().map_err(|e| e.to_string())?;
        (au, lk, s, pr)
    };

    let policy = crate::protects_policy::check_policy(
        &url,
        &session,
        &policy_url,
        &policy_key,
        prefer_remote,
    )
    .await;

    if policy.decision == "block" {
        return Ok(policy);
    }

    let backend = crate::tab_windows::backend(&app)?;
    let loaded_url = match backend {
        crate::tab_backend::TabBackendKind::Camofox => {
            crate::tab_windows_camofox::navigate(
                &app,
                tab_id,
                &url,
                policy.request_privileged,
                &session,
            )
            .await
        }
        crate::tab_backend::TabBackendKind::Webkit => {
            crate::tab_windows::create_tab_window(&app, tab_id, &url, policy.request_privileged)
                .map(|_| url.clone())
        }
    };
    let loaded_url = match loaded_url {
        Ok(value) => value,
        Err(error) => {
            return Ok(crate::protects_policy::block_result(
                &format!("tab_window_refused:{error}"),
                &policy.domain,
            ));
        }
    };
    let context = determine_context(&loaded_url);
    {
        let mut tabs = state.tabs.lock().map_err(|e| e.to_string())?;
        if let Some(tab) = tabs.iter_mut().find(|t| t.id == tab_id) {
            tab.url = loaded_url.clone();
            tab.context = context.clone();
            tab.loading = true;
        }
    }

    let _ = window.emit(
        "genysys:navigate",
        serde_json::json!({
            "tabId": tab_id,
            "url": loaded_url,
            "context": context,
            "chain": policy.chain,
            "privileged": policy.request_privileged,
        }),
    );

    Ok(policy)
}

fn extract_domain(url: &str) -> Option<String> {
    let u = if url.starts_with("http") {
        url.to_string()
    } else {
        format!("https://{url}")
    };
    url::Url::parse(&u).ok().and_then(|parsed| {
        parsed
            .host_str()
            .map(|host| host.trim_start_matches("www.").to_lowercase())
    })
}

fn is_privileged_product_url(url: &str) -> bool {
    let Some(domain) = extract_domain(url) else {
        return false;
    };
    PRIVILEGED_PRODUCT_DOMAINS
        .iter()
        .any(|entry| domain == *entry || domain.ends_with(&format!(".{entry}")))
}

fn determine_context(url: &str) -> TabContext {
    if is_privileged_product_url(url) {
        TabContext::Privileged
    } else {
        TabContext::Normal
    }
}

#[cfg(test)]
mod tests {
    use super::{determine_context, extract_domain, is_privileged_product_url};
    use crate::TabContext;

    #[test]
    fn domain_classification_is_fail_closed() {
        assert_eq!(
            extract_domain("https://www.example.com/a"),
            Some("example.com".into())
        );
        assert!(is_privileged_product_url(
            "https://mail.rnk-enterprise.us/inbox"
        ));
        assert!(!is_privileged_product_url("https://evilrnk-enterprise.us"));
        assert_eq!(determine_context("https://example.com"), TabContext::Normal);
    }
}
