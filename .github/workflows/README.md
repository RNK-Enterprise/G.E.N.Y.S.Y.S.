# Workflows

- `verify.yml` — every push: global audit → jest → playwright → cargo test, then `verify-live` (compositor-level tab proof under Xvfb), `native-cookie-proof` (real WebKitGTK first-request/HttpOnly/SameSite/logout-command proof under Xvfb, plus SameSite=Lax negative and production-domain clear runs), manual `native-cookie-proof-windows` / `native-cookie-proof-macos` jobs for WebView2/WKWebView, and `package` (.deb/.rpm/AppImage + smoke suite) as independent required-check-attachable jobs.
- `release.yml` — tag-triggered bundle release; notes regenerate via API on tag re-push.
