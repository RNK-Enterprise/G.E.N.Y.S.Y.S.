# G.E.N.E.S.Y.S. native shell (Tauri)

Rust backend: window/tab-window management, auth gate, P.R.O.T.E.C.T.S. policy enforcement, command sessions, attestation.

## Build
- Always build through the wrapper: `npm run build` / `npm run build:debug` / `npm run check:rust` — `scripts/with-webkit-pc.sh` supplies the WebKitGTK 4.1 pkg-config path on non-Fedora hosts.
- `tauri.conf.json` validates `distDir` at compile time; build the frontend (`npm run build:vite`) before `cargo build` from a fresh clone.

## Layout
- `src/main.rs` — app setup, IPC command registration, diagnostics journal (`[genysys:page]`, `[genysys:boot]`, `[genysys:mainwin]`)
- `src/tab_windows.rs` + `tab_windows_webkit.rs` + `tab_windows_camofox.rs` + `camofox_client.rs` + `camofox_client_actions.rs` + `camofox_client_navigate.rs` + `camofox_policy_bridge.rs` + `camofox_capabilities.rs` + `tab_commands.rs` — the `[genysys:tabwin]` lifecycle, loopback Camofox bridge, hop-by-hop redirect policy callback, bounded inspection and interaction capabilities, and backend boundary the live proof asserts
- `../docs/TAB_BACKENDS.md` — one-logical-tab backend contract and Camofox bridge status
- `src/protects_policy.rs`, `auth.rs`, `command_session.rs`, `attestation.rs` — the policy plane
- `*_tests.rs` — Rust unit tests, compiled as modules of their counterparts
