//! Tests for the C.O.M.M.A.N.D./Resolute session client (contract-shaped).
//! A local mock B1 exercises ok / denied / dark / heartbeat tiers.

#[cfg(test)]
mod tests {
    use crate::command_session::{CommandClient, GatePhase};
    use serde_json::json;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    fn spawn_mock_b1(verify_ok: bool, fail_beats: u32) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            let mut beats_failed = 0u32;
            for stream in listener.incoming() {
                let mut stream = match stream {
                    Ok(s) => s,
                    Err(_) => continue,
                };
                let mut buf = [0u8; 8192];
                let _ = stream.read(&mut buf);
                let req = String::from_utf8_lossy(&buf);
                let path = req
                    .split(' ')
                    .nth(1)
                    .unwrap_or("/")
                    .to_string();

                let (status, body) = if path.contains("/api/v1/owner/session/start") {
                    (
                        "200 OK",
                        json!({ "ok": true, "sessionId": "sess-1" }).to_string(),
                    )
                } else if path.contains("/api/v1/owner/session/verify") {
                    if verify_ok {
                        (
                            "200 OK",
                            json!({
                                "ok": true,
                                "token": "b1-token-xyz",
                                "tier": "full",
                                "ownerId": "odinn"
                            })
                            .to_string(),
                        )
                    } else {
                        (
                            "200 OK",
                            json!({ "ok": false, "reason": "incomplete-handshake" }).to_string(),
                        )
                    }
                } else if path.contains("/gateway/v1/heartbeat") {
                    beats_failed += 1;
                    if beats_failed <= fail_beats {
                        ("503 SERVICE UNAVAILABLE", json!({ "ok": false }).to_string())
                    } else {
                        ("200 OK", json!({ "ok": true }).to_string())
                    }
                } else {
                    ("404 NOT FOUND", json!({}).to_string())
                };

                let resp = format!(
                    "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    status,
                    body.len(),
                    body
                );
                let _ = stream.write_all(resp.as_bytes());
                let _ = stream.flush();
            }
        });
        format!("http://127.0.0.1:{}", port)
    }

    #[tokio::test]
    async fn dark_url_fails_closed() {
        let mut c = CommandClient::new(None);
        assert_eq!(c.state.phase, GatePhase::Dark);
        let err = c.exchange("", &json!({})).await.unwrap_err();
        assert_eq!(err, "command_dark");
        assert_eq!(c.state.phase, GatePhase::Dark);
    }

    #[tokio::test]
    async fn unreachable_host_fails_closed_to_holding() {
        let mut c = CommandClient::new(Some("http://127.0.0.1:1".into()));
        assert_eq!(c.state.phase, GatePhase::Holding);
        let err = c
            .exchange("http://127.0.0.1:1", &json!({ "evidence": "x" }))
            .await
            .unwrap_err();
        assert_eq!(err, "command_unreachable_fail_closed");
        assert_ne!(c.state.phase, GatePhase::Open);
    }

    #[tokio::test]
    async fn denied_handshake_fails_closed() {
        let base = spawn_mock_b1(false, 0);
        let mut c = CommandClient::new(Some(base.clone()));
        let err = c.exchange(&base, &json!({ "booleansOnly": true })).await.unwrap_err();
        assert_eq!(err, "command_exchange_denied");
        assert_eq!(c.state.phase, GatePhase::Holding);
        assert!(c.state.last_error.unwrap_or_default().contains("incomplete-handshake"));
    }

    #[tokio::test]
    async fn good_grant_opens_session() {
        let base = spawn_mock_b1(true, 0);
        let mut c = CommandClient::new(Some(base.clone()));
        let out = c.exchange(&base, &json!({ "fourLayers": "real-evidence" })).await.unwrap();
        assert_eq!(out["ok"], json!(true));
        assert_eq!(c.state.phase, GatePhase::Open);
        assert_eq!(c.state.tier.as_deref(), Some("full"));
        assert!(c.is_open());
    }

    #[tokio::test]
    async fn heartbeat_three_strikes_drops_session() {
        let base = spawn_mock_b1(true, 99); // always fail beats
        let mut c = CommandClient::new(Some(base.clone()));
        c.exchange(&base, &json!({})).await.unwrap();
        assert!(c.is_open());

        // Beats 1-2: degraded but alive.
        let b1 = c.beat(&base).await.unwrap();
        assert_eq!(b1["missedBeats"], json!(1));
        assert!(c.is_open());
        let b2 = c.beat(&base).await.unwrap();
        assert_eq!(b2["missedBeats"], json!(2));
        assert!(c.is_open());

        // Beat 3: link drop → session reset (fail closed).
        let err = c.beat(&base).await.unwrap_err();
        assert_eq!(err, "command_heartbeat_link_drop");
        assert_eq!(c.state.phase, GatePhase::Holding);
        assert!(!c.is_open());
    }

    #[tokio::test]
    async fn recovered_beat_resets_missed_counter() {
        let base = spawn_mock_b1(true, 1); // fail once, then recover
        let mut c = CommandClient::new(Some(base.clone()));
        c.exchange(&base, &json!({})).await.unwrap();
        assert!(c.beat(&base).await.is_ok()); // missed 1
        let ok = c.beat(&base).await.unwrap(); // recovered
        assert_eq!(ok["missedBeats"], json!(0));
        assert!(c.is_open());
    }
}
