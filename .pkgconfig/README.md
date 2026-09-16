# .pkgconfig — WebKitGTK 4.0 → 4.1 name shim

pkg-config lookup path used by `scripts/with-webkit-pc.sh` and
`src-tauri/.cargo/config.toml`. Ubuntu 24.04 ships WebKitGTK under 4.1
sonames while Tauri 1 links the 4.0 names; these symlinks map the 4.0
module names (and, under `lib/`, the 4.0 shared-object names) onto their
4.1 counterparts. Do not "fix" this by installing 4.0 packages — see the
repo-root README.

Tracked on purpose: the shim is part of the build, not an artifact.
