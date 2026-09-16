# .pkgconfig/lib — shared-object name symlinks for the WebKitGTK 4.0 → 4.1 shim

Maps 4.0 `libwebkit2gtk`/`libjavascriptcoregtk` sonames onto the 4.1
libraries at link time (added to the linker path by
`src-tauri/.cargo/config.toml`). See `../README.md`.

Tracked on purpose: the shim is part of the build, not an artifact.
