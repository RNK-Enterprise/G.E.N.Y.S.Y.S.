# Native cookie live proof

Status: executable harness for Linux WebKitGTK, Windows WebView2, and macOS
WKWebView. The Linux path is proof-only: it makes the hidden proof window
ignore the temporary certificate, while production keeps WebKitGTK's normal
certificate policy.

## Run

```bash
npm run proof:native-cookie
```

Requirements: Node 22+, npm, Rust, OpenSSL, and a graphical desktop session.
macOS temporarily installs the generated certificate in the login keychain and
removes it on exit. Windows uses WebView2's `--ignore-certificate-errors` flag
and Linux uses WebKitGTK's TLS-error bypass, both on the isolated proof window
only. The production build never enables either bypass.

The script builds `dist/` and the feature-gated binary, starts a loopback HTTPS
probe, launches GENYSYS with `GENYSYS_NATIVE_COOKIE_PROOF=1`, and exits non-zero
if any check fails. Linux starts the proof window on a plain-HTTP boot page,
configures the proof-only TLS policy, then navigates to the HTTPS probe so the
certificate error cannot win a race with the first request.

## What it proves

The proof uses a random `genysys_attest` value and the loopback domain
`localhost`, never `.rnk-enterprise.us` or the production cookie jar.

1. `/blank` loads, then `native_cookie::set_cookie` writes the cookie.
2. `/first` must receive `genysys_attest` on its **first** HTTP request.
3. JavaScript on `/first` must not find the cookie in `document.cookie`
   (`HttpOnly`).
4. The page navigates to `https://127.0.0.1:<port>/cross-site`, which submits a
   cross-site POST back to `localhost`. The cookie must be sent, which requires
   `SameSite=None` **and** `Secure`; a Lax/Strict or insecure cookie is omitted.
5. `/first-done` invokes the real Tauri `attestation_cookie_clear` command over
   IPC. The command calls the production `clear_cookie` wrapper; a proof-only
   domain override redirects it to the loopback jar. The page waits for the
   command to settle before navigating.
6. `/after` must receive no `genysys_attest`, and JavaScript must not see one.

The checks are reported as `first_request_has_cookie`,
`http_only_hidden_from_javascript`, `samesite_none_sent_cross_site`,
`logout_command_completed`, `logout_request_without_cookie`, and
`logout_hidden_from_javascript`. The report also records the IPC result under
`state.logout`.

## Production-domain clear mode

```bash
npm run proof:native-cookie -- --domain
```

This Linux WebKitGTK mode closes the domain-override gap without weakening
production settings. It seeds `genysys_attest` for the exact production domain
`.rnk-enterprise.us` with `SameSite=None` and `Secure` through the production
setter, reads the real cookie jar back, invokes the unmodified
`attestation_cookie_clear` command **without** the proof domain override, and
reads the jar again. It does not edit `/etc/hosts` or navigate to the
production domain; the native cookie manager stores and queries the domain
directly. The report is `mode: production-domain` with
`cookie_seeded`, `cookie_same_site_none`, `clear_command_completed`, and
`cookie_cleared` checks. A non-Linux host reports
`native_cookie_read_unsupported` rather than claiming a pass.

## Negative mode

```bash
npm run proof:native-cookie -- --negative
```

This writes the same cookie with `SameSite=Lax`. The cross-site POST must then
omit it, so `samesite_none_sent_cross_site` must be `false`; the other five
checks must still be `true`. The report identifies the mode as
`lax-negative`, records the expected cross-site value, and exits zero only when
that expectation holds. A cross-site cookie in this mode fails the run, which
proves the probe is actually observing the cookie header rather than passing
unconditionally.

## CI

`.github/workflows/verify.yml` runs the Linux WebKitGTK positive,
SameSite=Lax negative, and production-domain proofs on every push as the
`native-cookie-proof` job under `xvfb-run`, then runs
`scripts/verify-production-cookie-exclusion.sh` against a feature-off binary.
The `native-cookie-proof-windows` and `native-cookie-proof-macos` jobs are
manual (`workflow_dispatch`) because they need WebView2 and WKWebView hosts;
dispatch the workflow on the PR branch to run them. The Linux job does not
substitute for either native run.

## Implementation

- `src-tauri/src/native_cookie_proof.rs` — feature-gated proof window,
  page-load state machine, and proof-window-only HTTPS localhost IPC scope.
- `src-tauri/src/native_cookie.rs` — production wrappers, the proof-only
  SameSite selector, and the proof-only logout-domain override.
- `src-tauri/src/tab_windows_webkit.rs` — the real `attestation_cookie_clear`
  command exercised by the proof.
- `scripts/native-cookie-live-proof-server.mjs` — HTTPS probe and assertions.
- `scripts/native-cookie-live-proof.sh` — certificate, trust, build, launch,
  and cleanup.

The production build does not include the proof module unless the
`native-cookie-live-proof` Cargo feature is enabled. Its binary is checked by
`scripts/verify-production-cookie-exclusion.sh`, which fails if the binary
contains the proof module marker, `GENYSYS_COOKIE_PROOF`, or
`RemoteDomainAccessScope`, and confirms the production domain is still present.
