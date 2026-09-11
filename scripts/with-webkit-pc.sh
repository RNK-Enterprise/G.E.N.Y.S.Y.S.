#!/usr/bin/env bash
# Ubuntu 24.04+ ships WebKitGTK 4.1; Tauri 1 still looks for 4.0 pkg-config names.
# This wrapper points 4.0 names at the 4.1 .pc files under .pkgconfig/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PKG_CONFIG_PATH="${ROOT}/.pkgconfig:${PKG_CONFIG_PATH:-/usr/lib/x86_64-linux-gnu/pkgconfig}"
exec "$@"
