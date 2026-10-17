# Rust sources

Each domain module pairs with a `*_tests.rs` compiled as a `#[cfg(test)]` module. `main.rs` is the only place allowed to touch Tauri builder setup; policy logic stays in `protects_policy.rs` and is fail-closed by contract.

Production sessions are C.O.M.M.A.N.D.-gated (`command_gate.rs`, `command_session.rs`). If COMMAND/Resolute is dark, HOLD — do not invent an IdP. Shortcodes are DEV/bootstrap only.
