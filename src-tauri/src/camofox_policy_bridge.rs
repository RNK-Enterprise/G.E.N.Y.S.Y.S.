//! Loopback policy callback for Camofox hop-by-hop redirect interception.
//!
//! Camofox pauses each main-frame navigation hop and asks GENYSYS before the
//! request continues. Unreachable, unauthorized, or blocked decisions refuse.

use crate::tab_windows::{classify_tab_navigation, window_allowed};
use crate::AppState;
use serde::Deserialize;
use serde_json::json;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, Runtime};

const CHECK_PATH: &str = "/camofox/policy/check";
const MAX_BODY_BYTES: usize = 64 * 1024;
const READ_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Debug, Clone)]
pub struct CamofoxPolicyBridge {
    pub origin: String,
    pub token: String,
}

#[derive(Debug, Default)]
pub struct CamofoxPolicyBridgeState {
    inner: Mutex<Option<LiveBridge>>,
}

#[derive(Debug)]
struct LiveBridge {
    bridge: CamofoxPolicyBridge,
    stop: Arc<AtomicBool>,
}

impl Drop for LiveBridge {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}

#[derive(Debug, Deserialize)]
struct CheckRequest {
    url: String,
    #[serde(default)]
    hop: u32,
    #[serde(rename = "tabId")]
    tab_id: Option<u32>,
    #[serde(rename = "remoteTabId")]
    remote_tab_id: Option<String>,
    #[serde(rename = "navigationType")]
    navigation_type: Option<String>,
}

impl CamofoxPolicyBridgeState {
    /// Ensure the loopback callback is listening and return its dial coordinates.
    pub fn ensure<R: Runtime>(&self, app: &AppHandle<R>) -> Result<CamofoxPolicyBridge, String> {
        if let Ok(guard) = self.inner.lock() {
            if let Some(live) = guard.as_ref() {
                return Ok(live.bridge.clone());
            }
        }
        self.start(app)
    }

    fn start<R: Runtime>(&self, app: &AppHandle<R>) -> Result<CamofoxPolicyBridge, String> {
        let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(live) = guard.as_ref() {
            return Ok(live.bridge.clone());
        }
        let listener =
            TcpListener::bind("127.0.0.1:0").map_err(|_| "camofox_policy_bind_failed".to_string())?;
        listener
            .set_nonblocking(false)
            .map_err(|_| "camofox_policy_bind_failed".to_string())?;
        let port = listener
            .local_addr()
            .map_err(|_| "camofox_policy_bind_failed".to_string())?
            .port();
        let token = mint_token()?;
        let bridge = CamofoxPolicyBridge {
            origin: format!("http://127.0.0.1:{port}"),
            token: token.clone(),
        };
        let stop = Arc::new(AtomicBool::new(false));
        let stop_thread = Arc::clone(&stop);
        let app_thread = app.clone();
        thread::Builder::new()
            .name("genysys-camofox-policy".into())
            .spawn(move || serve(listener, app_thread, token, stop_thread))
            .map_err(|_| "camofox_policy_spawn_failed".to_string())?;
        *guard = Some(LiveBridge {
            bridge: bridge.clone(),
            stop,
        });
        eprintln!(
            "[genysys:camofox] policy callback listening on {}{}",
            bridge.origin, CHECK_PATH
        );
        Ok(bridge)
    }
}

/// Resolve the managed bridge state and ensure it is live.
pub fn ensure_bridge<R: Runtime>(app: &AppHandle<R>) -> Result<CamofoxPolicyBridge, String> {
    app.state::<CamofoxPolicyBridgeState>().ensure(app)
}

fn serve<R: Runtime>(
    listener: TcpListener,
    app: AppHandle<R>,
    token: String,
    stop: Arc<AtomicBool>,
) {
    listener
        .set_nonblocking(true)
        .unwrap_or_else(|_| ());
    while !stop.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, _)) => {
                let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
                let _ = stream.set_write_timeout(Some(READ_TIMEOUT));
                handle_client(stream, &app, &token);
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(25));
            }
            Err(_) => thread::sleep(Duration::from_millis(50)),
        }
    }
}

fn handle_client<R: Runtime>(mut stream: TcpStream, app: &AppHandle<R>, token: &str) {
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 4096];
    loop {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                buffer.extend_from_slice(&chunk[..n]);
                if buffer.len() > MAX_BODY_BYTES + 8192 {
                    let _ = write_response(&mut stream, 413, json!({ "decision": "block", "reason": "camofox_policy_body_too_large" }));
                    let _ = stream.shutdown(Shutdown::Both);
                    return;
                }
                if request_complete(&buffer) {
                    break;
                }
            }
            Err(_) => {
                let _ = write_response(&mut stream, 400, json!({ "decision": "block", "reason": "camofox_policy_request_malformed" }));
                let _ = stream.shutdown(Shutdown::Both);
                return;
            }
        }
    }
    let response = match evaluate_request(&buffer, app, token) {
        Ok(value) => (200, value),
        Err((status, reason)) => (status, json!({ "decision": "block", "reason": reason })),
    };
    let _ = write_response(&mut stream, response.0, response.1);
    let _ = stream.shutdown(Shutdown::Both);
}

fn evaluate_request<R: Runtime>(
    raw: &[u8],
    app: &AppHandle<R>,
    token: &str,
) -> Result<serde_json::Value, (u16, String)> {
    let text = std::str::from_utf8(raw).map_err(|_| (400, "camofox_policy_request_malformed".into()))?;
    let (header_text, body_text) = text
        .split_once("\r\n\r\n")
        .ok_or((400, "camofox_policy_request_malformed".into()))?;
    let mut lines = header_text.lines();
    let request_line = lines.next().unwrap_or_default();
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let path = parts.next().unwrap_or_default();
    if method != "POST" || path != CHECK_PATH {
        return Err((404, "camofox_policy_path_unknown".into()));
    }
    let mut content_length = 0usize;
    let mut authorized = false;
    for line in lines {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        let name = name.trim().to_ascii_lowercase();
        let value = value.trim();
        if name == "content-length" {
            content_length = value.parse().unwrap_or(0);
        }
        if name == "authorization" {
            authorized = bearer_matches(value, token);
        }
    }
    if !authorized {
        return Err((401, "camofox_policy_unauthorized".into()));
    }
    if content_length == 0 || content_length > MAX_BODY_BYTES || body_text.len() < content_length {
        return Err((400, "camofox_policy_body_invalid".into()));
    }
    let body = &body_text[..content_length];
    let request: CheckRequest =
        serde_json::from_str(body).map_err(|_| (400, "camofox_policy_body_invalid".into()))?;
    if request.url.trim().is_empty() {
        return Err((400, "camofox_policy_url_missing".into()));
    }
    let _ = (request.hop, request.tab_id, request.remote_tab_id, request.navigation_type);
    let session = app
        .try_state::<AppState>()
        .map(|state| {
            state
                .session
                .lock()
                .map(|value| value.clone())
                .unwrap_or_default()
        })
        .unwrap_or_default();
    let policy = classify_tab_navigation(&request.url, &session);
    if policy.request_privileged {
        return Ok(json!({
            "decision": "block",
            "reason": "camofox_attestation_bridge_unavailable",
            "domain": policy.domain,
        }));
    }
    if !window_allowed(&policy) {
        return Ok(json!({
            "decision": "block",
            "reason": policy.reason,
            "domain": policy.domain,
        }));
    }
    Ok(json!({
        "decision": "allow",
        "reason": policy.reason,
        "domain": policy.domain,
    }))
}

fn bearer_matches(header_value: &str, token: &str) -> bool {
    let Some(provided) = header_value
        .strip_prefix("Bearer ")
        .or_else(|| header_value.strip_prefix("bearer "))
    else {
        return false;
    };
    provided.trim() == token
}

fn request_complete(buffer: &[u8]) -> bool {
    let Some(index) = find_header_end(buffer) else {
        return false;
    };
    let headers = &buffer[..index];
    let body = &buffer[index + 4..];
    let content_length = headers
        .split(|&b| b == b'\n')
        .filter_map(|line| {
            let line = if line.ends_with(b"\r") {
                &line[..line.len() - 1]
            } else {
                line
            };
            let text = std::str::from_utf8(line).ok()?;
            let (name, value) = text.split_once(':')?;
            if name.eq_ignore_ascii_case("content-length") {
                value.trim().parse::<usize>().ok()
            } else {
                None
            }
        })
        .next()
        .unwrap_or(0);
    body.len() >= content_length
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

fn write_response(stream: &mut TcpStream, status: u16, body: serde_json::Value) -> std::io::Result<()> {
    let payload = body.to_string();
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        413 => "Payload Too Large",
        _ => "Error",
    };
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{payload}",
        payload.len()
    );
    stream.write_all(response.as_bytes())
}

fn mint_token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    let mut file = std::fs::File::open("/dev/urandom")
        .map_err(|_| "camofox_policy_token_unavailable".to_string())?;
    file.read_exact(&mut bytes)
        .map_err(|_| "camofox_policy_token_unavailable".to_string())?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

#[cfg(test)]
mod tests {
    use super::{bearer_matches, find_header_end, request_complete};

    #[test]
    fn bearer_comparison_requires_exact_token() {
        assert!(bearer_matches("Bearer secret", "secret"));
        assert!(!bearer_matches("Bearer other", "secret"));
        assert!(!bearer_matches("secret", "secret"));
    }

    #[test]
    fn request_framing_waits_for_declared_body() {
        let partial = b"POST /camofox/policy/check HTTP/1.1\r\nContent-Length: 5\r\n\r\n{";
        assert!(!request_complete(partial));
        let complete = b"POST /camofox/policy/check HTTP/1.1\r\nContent-Length: 5\r\n\r\n{\"a\":1}";
        assert!(request_complete(complete));
        assert_eq!(find_header_end(complete), Some(54));
    }
}
