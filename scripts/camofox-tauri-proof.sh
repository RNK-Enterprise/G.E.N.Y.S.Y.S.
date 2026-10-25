#!/usr/bin/env bash
# GENYSYS Camofox Tauri shell proof against a live Camofox+noVNC instance.
# Asserts hop-accept journal + Camofox surface window (not the WebKit title).
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
CAMOFOX_URL="${GENYSYS_CAMOFOX_URL:-http://127.0.0.1:9378}"
CODE="${GENYSYS_LIVE_CODE:-genysys-odinn}"
NAV_URL="${GENYSYS_LIVE_URL:-example.com}"
TIMEOUT="${GENYSYS_LIVE_TIMEOUT:-45}"
BIN="${GENYSYS_LIVE_BIN:-$ROOT/src-tauri/target/debug/rnk-genysys}"
KEEP="${GENYSYS_LIVE_KEEP:-0}"
FORCE_XVFB="${GENYSYS_LIVE_XVFB:-1}"
IS_INNER="${GENYSYS_CAMOFOX_TAURI_INNER:-0}"

if [ -n "${GENYSYS_LIVE_SCRATCH:-}" ] && [ -d "$GENYSYS_LIVE_SCRATCH" ]; then
  SCRATCH=$GENYSYS_LIVE_SCRATCH
else
  SCRATCH=$(mktemp -d /tmp/genysys-camofox-tauri.XXXXXX)
fi
APP_LOG="$SCRATCH/app.log"
VITE_PID=""
APP_PID=""
RC=1

die() { echo "camofox-tauri-proof: $1" >&2; exit "${2:-2}"; }

cleanup() {
  if [ "$IS_INNER" = 1 ]; then
    [ -n "${APP_PID}" ] && kill -TERM -- "-$APP_PID" 2>/dev/null || true
    [ -n "${VITE_PID}" ] && kill -TERM -- "-$VITE_PID" 2>/dev/null || true
    sleep 1
    return
  fi
  [ -n "${APP_PID}" ] && kill -TERM -- "-$APP_PID" 2>/dev/null || true
  [ -n "${VITE_PID}" ] && kill -TERM -- "-$VITE_PID" 2>/dev/null || true
  sleep 1
  if [ "$KEEP" = 1 ] || [ "$RC" -ne 0 ]; then
    echo "camofox-tauri-proof: scratch kept at $SCRATCH (log: $APP_LOG)" >&2
  else
    rm -rf "$SCRATCH"
  fi
}
trap cleanup EXIT INT TERM

have_win() { [ -n "$(xdotool search --onlyvisible --name "$1" 2>/dev/null | head -1)" ]; }
wait_win() {
  local waited=0
  while [ "$waited" -lt "$TIMEOUT" ]; do
    have_win "$1" && return 0
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}
focus_win() {
  # Match verify-live: XTEST follows the pointer; park on titlebar chrome.
  xdotool windowactivate "$1" 2>/dev/null || xdotool windowfocus "$1"
  local geo x y w
  geo=$(xdotool getwindowgeometry "$1" 2>/dev/null) || true
  if [ -n "$geo" ]; then
    x=$(echo "$geo" | awk '/Position/{print $2}' | cut -d, -f1)
    y=$(echo "$geo" | awk '/Position/{print $2}' | cut -d, -f2)
    w=$(echo "$geo" | awk '/Geometry/{print $2}' | cut -dx -f1)
    [ -n "$x" ] && [ -n "$w" ] && xdotool mousemove --sync $((x + w / 2)) $((y + 12)) 2>/dev/null
  fi
  sleep 0.5
}

drive() {
  command -v xdotool >/dev/null 2>&1 || die "xdotool required"
  [ -x "$BIN" ] || die "binary missing: $BIN"
  [ "$(strings -a "$BIN" | grep -c 'genysys:tabwin' || true)" -gt 0 ] || die "stale binary"

  echo "camofox-tauri-proof against $CAMOFOX_URL"
  local health vnc
  health=$(curl -sf --max-time 5 "$CAMOFOX_URL/health" || true)
  echo "$health" | grep -q '"browserConnected":true' || die "Camofox not connected: $health"
  vnc=$(curl -sf --max-time 5 "$CAMOFOX_URL/vnc/status" || true)
  echo "$vnc" | grep -q '"enabled":true' || die "VNC not enabled: $vnc"
  echo "$vnc" | grep -q '"running":true' || die "VNC not running: $vnc"
  echo "$vnc" | grep -q '"/vnc.html"' || die "VNC path missing: $vnc"
  echo "camofox: healthy + VNC ready"

  cd "$ROOT"
  if curl -sf --max-time 2 -o /dev/null http://127.0.0.1:1420/; then
    echo "dev server: already up"
  else
    setsid node_modules/.bin/vite >"$SCRATCH/vite.log" 2>&1 </dev/null &
    VITE_PID=$!
    local ok=0
    for _ in $(seq 1 30); do
      curl -sf --max-time 2 -o /dev/null http://127.0.0.1:1420/ && { ok=1; break; }
      sleep 1
    done
    [ "$ok" = 1 ] || die "vite failed on :1420"
    echo "dev server: started (pid $VITE_PID)"
  fi

  local app_ok=0 launch
  for launch in 1 2 3; do
    setsid env NO_AT_BRIDGE=1 GDK_BACKEND=x11 \
      WEBKIT_FORCE_SANDBOX=0 WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 \
      WEBKIT_DISABLE_COMPOSITING_MODE=1 \
      WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1 \
      no_proxy=localhost,127.0.0.1 NO_PROXY=localhost,127.0.0.1 \
      GENYSYS_TEST_MODE=1 \
      GENYSYS_TAB_BACKEND=camofox \
      GENYSYS_CAMOFOX_URL="$CAMOFOX_URL" \
      "$BIN" >"$APP_LOG" 2>&1 </dev/null &
    APP_PID=$!
    echo "app: launched pid $APP_PID (attempt $launch)"
    if wait_win '^G\.E\.N\.E\.S\.Y\.S\.$'; then app_ok=1; break; fi
    kill -9 -- -"$APP_PID" 2>/dev/null || true
    APP_PID=""
    tail -8 "$APP_LOG" | sed 's/^/    /'
  done
  [ "$app_ok" = 1 ] || die "main window never appeared"

  local MAIN ready waited created attempt
  MAIN=$(xdotool search --onlyvisible --name '^G\.E\.N\.E\.S\.Y\.S\.$' | head -1)
  focus_win "$MAIN"
  echo "main window: up ($MAIN)"

  ready=0
  waited=0
  while [ "$waited" -lt $((TIMEOUT * 3)) ]; do
    if grep -q "genysys:page.*main page initialized" "$APP_LOG" 2>/dev/null; then ready=1; break; fi
    if [ -n "$APP_PID" ] && ! kill -0 "$APP_PID" 2>/dev/null; then break; fi
    sleep 2
    waited=$((waited + 2))
  done
  [ "$ready" = 1 ] || die "main page never initialized"
  echo "page: initialized after ${waited}s"

  created=0
  for attempt in 1 2; do
    focus_win "$MAIN"
    xdotool type --delay 40 "$CODE"
    xdotool key Return
    sleep 3
    focus_win "$MAIN"
    xdotool key --clearmodifiers ctrl+t
    sleep 1
    focus_win "$MAIN"
    xdotool key --clearmodifiers ctrl+l
    sleep 0.5
    xdotool type --delay 40 "$NAV_URL"
    xdotool key Return
    echo "drive: attempt $attempt — auth + navigate to $NAV_URL"
    waited=0
    while [ "$waited" -lt "$TIMEOUT" ]; do
      if have_win '^GENYSYS Camofox Tab$' || have_win '^Camofox - '; then created=1; break; fi
      if grep -Eq 'camofox tab-[0-9]+ accepted [0-9]+ hop' "$APP_LOG"; then created=1; break; fi
      sleep 1
      waited=$((waited + 1))
    done
    [ "$created" = 1 ] && break
  done

  if [ "$created" != 1 ]; then
    echo "FAILED: Camofox surface never appeared"
    grep -E 'genysys:tabwin|genysys:camofox|camofox_' "$APP_LOG" | tail -40 | sed 's/^/    /'
    exit 1
  fi
  echo "create: OK — Camofox surface present"

  local fail=0
  if grep -Eq 'camofox tab-[0-9]+ accepted [0-9]+ hop' "$APP_LOG"; then
    echo "hops: OK — $(grep -Eo 'camofox tab-[0-9]+ accepted [0-9]+ hop\(s\); final=[^ ]+' "$APP_LOG" | tail -1)"
  else
    echo "FAILED: missing camofox hop-accept journal"
    fail=1
  fi
  if grep -Eq 'camofox\.html\?vncPort=' "$APP_LOG"; then
    echo "surface: OK — $(grep -Eo 'camofox\.html\?vncPort=[0-9]+' "$APP_LOG" | tail -1)"
  else
    echo "FAILED: camofox.html surface not initialized"
    fail=1
  fi
  if kill -0 "$APP_PID" 2>/dev/null; then
    echo "survivor: OK — app still alive"
  else
    echo "FAILED: app died"
    fail=1
  fi
  return "$fail"
}

if [ "$FORCE_XVFB" = 1 ] || [ -z "${DISPLAY:-}" ]; then
  if [ "$IS_INNER" = 1 ]; then
    drive; RC=$?
  else
    command -v xvfb-run >/dev/null 2>&1 || die "xvfb-run required"
    echo "camofox-tauri-proof: running under Xvfb"
    GENYSYS_CAMOFOX_TAURI_INNER=1 GENYSYS_LIVE_SCRATCH="$SCRATCH" \
      xvfb-run -a -s "-screen 0 1280x800x24" bash "$0"
    RC=$?
  fi
else
  drive; RC=$?
fi

if [ "$IS_INNER" = 1 ]; then exit "$RC"; fi
if [ "$RC" -eq 0 ]; then
  echo
  echo "CAMOFOX-TAURI PROOF OK"
else
  echo
  echo "CAMOFOX-TAURI PROOF FAILED"
fi
exit "$RC"
