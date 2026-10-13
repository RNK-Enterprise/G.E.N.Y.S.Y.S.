# GENYSYS native shell (Tauri)

Rust backend: window/tab-window management, auth gate, Lisa policy enforcement, command sessions, attestation.

## Build
- Always build through the wrapper: `npm run build` / `npm run build:debug` / `npm run check:rust` — `scripts/with-webkit-pc.sh` supplies the WebKitGTK 4.1 pkg-config path on non-Fedora hosts.
- `tauri.conf.json` validates `distDir` at compile time; build the frontend (`npm run build:vite`) before `cargo build` from a fresh clone.

## Layout
- `src/main.rs` — app setup, IPC command registration, diagnostics journal (`[genysys:page]`, `[genysys:boot]`, `[genysys:mainwin]`)
- `src/tab_windows.rs` + `tab_commands.rs` — the `[genysys:tabwin]` lifecycle the live proof asserts
- `src/lisa_policy.rs`, `auth.rs`, `command_session.rs`, `attestation.rs` — the policy plane
- `*_tests.rs` — Rust unit tests, compiled as modules of their counterparts
