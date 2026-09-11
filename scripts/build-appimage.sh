#!/usr/bin/env bash
# Axis — full production build including the AppImage step.
#
# Why this exists: appimagetool cannot resolve RELATIVE AppDir paths in this
# environment ("no such file or directory: axis.AppDir"), and Tauri 1.6.3
# passes it one relatively, so the plugin's final step fails. Everything else
# (compile, linuxdeploy, AppDir population, deb/rpm) succeeds. We therefore
# run the standard tauri build first, then invoke upstream appimagetool with
# ABSOLUTE paths over the populated AppDir.
#
# Usage: bash scripts/build-appimage.sh [tool_path]
#   tool_path defaults to /tmp/appimagetool.AppImage (fetched if missing).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE="$ROOT/src-tauri/target/release/bundle"
APPDIR="$BUNDLE/appimage/axis.AppDir"
OUT="$BUNDLE/appimage/axis_0.1.0_amd64.AppImage"
TOOL="${1:-/tmp/appimagetool.AppImage}"

cd "$ROOT"

# 1. Standard build (deb + rpm + the AppDir population step).
# The tauri bundler's own appimage step fails here (relative-path bug), so a
# non-zero exit is expected at that point — verify the rest really succeeded
# before continuing, otherwise bail honestly.
if ! npm run build; then
  test -f "$BUNDLE/deb/axis_0.1.0_amd64.deb" && test -d "$APPDIR/usr/bin" || {
    echo "FATAL: build failed before the AppImage step (no deb/AppDir)" >&2
    exit 1
  }
  echo "(expected) tauri appimage step failed — finishing it with absolute paths"
fi

# 2. AppImage via upstream appimagetool with absolute paths.
if [ ! -x "$TOOL" ]; then
  echo "Fetching appimagetool..."
  curl -sL -o "$TOOL" \
    https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
  chmod +x "$TOOL"
fi

rm -f "$OUT"
chmod +x "$APPDIR/AppRun" "$APPDIR/usr/bin/axis"
APPIMAGE_EXTRACT_AND_RUN=1 "$TOOL" "$APPDIR" "$OUT"

# 3. deb Depends repair: tauri 1.6.3 hardcodes libwebkit2gtk-4.0-37, which no
# longer exists on Ubuntu 24.04+ (WebKitGTK 4.1 is the real package, and that
# is what the binary links). Rewrite the control file with installable deps.
DEB="$BUNDLE/deb/axis_0.1.0_amd64.deb"
if [ -f "$DEB" ]; then
  WORK=$(mktemp -d)
  dpkg-deb -R "$DEB" "$WORK/pkg"
  sed -i 's/^Depends: .*$/Depends: libwebkit2gtk-4.1-0, libjavascriptcoregtk-4.1-0, libgtk-3-0/' \
    "$WORK/pkg/DEBIAN/control"
  dpkg-deb --root-owner-group -b "$WORK/pkg" "$DEB" >/dev/null
  rm -rf "$WORK"
  echo "deb Depends rewritten to webkit 4.1 set"
fi

echo
echo "Artifacts:"
ls -la "$BUNDLE"/deb/*.deb "$BUNDLE"/rpm/*.rpm "$OUT"
