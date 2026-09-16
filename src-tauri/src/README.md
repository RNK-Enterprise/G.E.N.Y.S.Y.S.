# Rust sources

Each domain module pairs with a `*_tests.rs` compiled as a `#[cfg(test)]` module. `main.rs` is the only place allowed to touch Tauri builder setup; policy logic stays in `lisa_policy.rs` and is fail-closed by contract.
