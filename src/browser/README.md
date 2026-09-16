# Tab management

Tab lifecycle split across `tab-manager.js` (core class) and `tab-manager-extras.js` (extensions). The Rust side mirrors the same lifecycle through the `[axis:tabwin]` journal — see `src-tauri/src/tab_windows.rs`.
