#!/usr/bin/env bash
# Axis™ — CI verification recipe
# Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
#
# What a fresh Linux box needs to run `npm run verify` for this repo. The
# GitHub workflow (.github/workflows/verify.yml) calls this script; keep them
# in sync. Run it locally to sanity-check CI before pushing.
#
# The committed .pkgconfig/ shims are absolute symlinks (webkit2gtk-4.0.* →
# the 4.1 files under /usr/lib/x86_64-linux-gnu), so any Ubuntu that has
# libwebkit2gtk-4.1-dev installed can use scripts/with-webkit-pc.sh unchanged.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if command -v apt-get >/dev/null 2>&1 && [ ! -f /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc ]; then
  echo "ci-verify: installing WebKitGTK 4.1 + GTK3 + soup2 development packages…"
  sudo apt-get update -qq
  sudo apt-get install -y -qq \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libsoup2.4-dev \
    patchelf
fi

cd "$ROOT"

[ -d node_modules ] || npm ci
npx playwright install chromium

echo "ci-verify: npm run verify"
exec npm run verify
