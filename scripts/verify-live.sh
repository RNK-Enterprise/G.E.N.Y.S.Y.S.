#!/usr/bin/env bash
# Axis™ — live compositor verification: tab create → close → OS-level destroy
# Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
#
# Closes the gap the mock-runtime cargo tests cannot: headless tests pin the
# close_tab_window bookkeeping contract, but the mock runtime's run_iteration()
# never pumps the CloseWindow message, so OS-level WebviewWindow destruction is
# unobservable there. This script proves it in a real compositor (or Xvfb):
#
#   1. Picks the app binary (debug by default) and requires the [axis:tabwin]
#      marker — a stale binary fails with a rebuild hint instead of passing
#      vacuously.
#   2. Ensures the Vite dev server (devPath) is up, starting it if needed
#      (release builds embed the UI and skip this).
#   3. Runs against $DISPLAY, or — with no display / --xvfb — under Xvfb so
#      CI runs the identical proof headlessly.
#   4. Drives the REAL UI with xdotool: auth code → Ctrl+T (new tab) →
#      Ctrl+L → URL → Enter. navigate_tab then creates the real WebviewWindow
#      after the policy allow.
#   5. Asserts the full [axis:tabwin] lifecycle (create → close → destroyed,
#      same tab id), that the "Axis Tab" X window existed and then vanished,
#      and reports WebKit helper process deltas as corroborating evidence.
#   6. Cleans up: app process group, dev server (only if we started it),
#      scratch profile — trap-guarded; on failure the scratch dir is KEPT and
#      its path printed so the app log survives for debugging.
#
# All app state goes to a scratch XDG profile, so this never touches the
# user's real Axis data. Windowing uses xdotool only (XQueryTree), so the
# headless path needs no window manager.
#
# Usage: bash scripts/verify-live.sh [--xvfb] [--release] [--bin PATH]
#                                    [--keep] [--code CODE] [--timeout SECS]
#   --xvfb          force the headless Xvfb path (auto when $DISPLAY is unset)
#   --release       use target/release/rnk-axis (skips the dev-server step)
#   --bin PATH      use an explicit binary (marker still enforced)
#   --keep          keep the scratch dir even on success (path is printed)
#   --code CODE     auth code for the gate (default: axis-odinn;
#                   override with AXIS_LIVE_CODE)
#   --timeout SECS  per-phase window/journal poll timeout (default 40)
# Exit codes: 0 proof passed · 1 proof failed · 2 bad usage/prerequisites.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CODE="${AXIS_LIVE_CODE:-axis-odinn}"
TIMEOUT=40
FORCE_XVFB=0
RELEASE=0
KEEP=0
BIN=""
IS_INNER="${AXIS_LIVE_INNER:-0}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --xvfb) FORCE_XVFB=1 ;;
    --release) RELEASE=1 ;;
    --bin) BIN=$2; shift ;;
    --keep) KEEP=1 ;;
    --code) CODE=$2; shift ;;
    --timeout) TIMEOUT=$2; shift ;;
    -h | --help) sed -n '2,/^set -uo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "verify-live: unknown option '$1' (try --help)" >&2; exit 2 ;;
  esac
  shift
done

# One scratch dir shared with the inner (Xvfb) re-invocation; on failure it is
# kept and printed so the captured app log survives.
if [ -n "${AXIS_LIVE_SCRATCH:-}" ] && [ -d "$AXIS_LIVE_SCRATCH" ]; then
  SCRATCH=$AXIS_LIVE_SCRATCH
else
  SCRATCH=$(mktemp -d /tmp/axis-live.XXXXXX)
fi
APP_LOG="$SCRATCH/app.log"
VITE_PID=""
APP_PID=""
INNER=0
RC=0

cleanup() {
  if [ "$INNER" = 1 ]; then
    [ -n "$APP_PID" ] && kill -TERM -- "-$APP_PID" 2>/dev/null
    [ -n "$VITE_PID" ] && kill -TERM -- "-$VITE_PID" 2>/dev/null
    sleep 1
  fi
  # Inner runs never delete: the outer process owns the scratch dir.
  if [ "$IS_INNER" = 1 ]; then return; fi
  if [ "$KEEP" = 1 ] || [ "$RC" -ne 0 ]; then
    echo "verify-live: scratch (app log: $APP_LOG) kept at $SCRATCH" >&2
  else
    rm -rf "$SCRATCH"
  fi
}
trap cleanup EXIT INT TERM

die() { local code=${2:-2}; echo "verify-live: $1" >&2; exit "$code"; }

# ── Prerequisites ────────────────────────────────────────────────────────────
command -v xdotool >/dev/null 2>&1 || die "prerequisite 'xdotool' not on PATH (apt install xdotool)"

# ── Binary selection + staleness guard ───────────────────────────────────────
if [ -n "$BIN" ]; then
  [ -x "$BIN" ] || die "binary not executable: $BIN"
elif [ "$RELEASE" = 1 ]; then
  # Bare `cargo build --release` emits the crate name; the tauri CLI build
  # additionally copies it to the productName (tauri.conf package). Accept
  # whichever exists, preferring the CLI layout when present.
  if [ -f "$ROOT/src-tauri/target/release/axis" ]; then
    BIN="$ROOT/src-tauri/target/release/axis"
  else
    BIN="$ROOT/src-tauri/target/release/rnk-axis"
  fi
else
  BIN="$ROOT/src-tauri/target/debug/rnk-axis"
fi
[ -f "$BIN" ] || die "binary missing: $BIN (debug: npm run build:debug · release: npm run build)"

# The lifecycle logging IS the observable asserted below; a binary from
# before it existed would "pass" vacuously. Content check, not mtime.
# (Counting matches instead of `grep -q`: under `set -o pipefail`, grep -q
# exiting early SIGPIPEs the producer and turns a match into a failure.)
if [ "$(strings -a "$BIN" | grep -c "axis:tabwin" || true)" -eq 0 ]; then
  die "binary $BIN predates [axis:tabwin] lifecycle logging — rebuild first (npm run build:debug)" 1
fi

# ── Small helpers (xdotool only — works with or without a window manager) ────
have_win() { [ -n "$(xdotool search --name "$1" 2>/dev/null | head -1)" ]; }
wait_win() { # <name-regex> — poll until it appears
  local waited=0
  while [ "$waited" -lt "$TIMEOUT" ]; do
    have_win "$1" && return 0
    sleep 1; waited=$((waited + 1))
  done
  return 1
}
wait_win_gone() { # <name-regex> — poll until it disappears
  local waited=0
  while [ "$waited" -lt "$TIMEOUT" ]; do
    have_win "$1" || return 0
    sleep 1; waited=$((waited + 1))
  done
  return 1
}
focus_win() { # <window-id> — X focus that works without a WM
  xdotool windowactivate "$1" 2>/dev/null || xdotool windowfocus "$1"
  sleep 0.5
}

drive() { # runs inside the chosen display session
  INNER=1
  cd "$ROOT"

  # ── Dev server (debug builds load the UI from devPath) ────────────────────
  if [ "$RELEASE" = 0 ]; then
    if curl -sf --max-time 2 -o /dev/null http://localhost:1420/; then
      echo "dev server: already running on :1420 (not ours — left alone)"
    else
      # Launch the vite binary directly. Going through `npm run dev` is a
      # trap: npm's children don't join the launched group, so cleanup
      # reaps the wrapper and ORPHANS vite, which then squats on :1420.
      # (drive() cd'd to $ROOT, so the relative binary path works; setsid
      # execs vite, making $! itself the process-group leader.)
      setsid node_modules/.bin/vite >"$SCRATCH/vite.log" 2>&1 < /dev/null &
      VITE_PID=$!
      ok=0
      for _ in $(seq 1 30); do
        curl -sf --max-time 2 -o /dev/null http://localhost:1420/ && { ok=1; break; }
        sleep 1
      done
      if [ "$ok" != 1 ]; then
        echo "FAILED: vite dev server did not come up on :1420"
        tail -10 "$SCRATCH/vite.log" 2>/dev/null | sed 's/^/    /'
        return 1
      fi
      echo "dev server: started (pid $VITE_PID)"
    fi
  fi

  # ── Launch the app (own process group → clean group kill in cleanup) ─────
  # A release (production) build holds fail-closed with no auth core; the
  # live drive is by definition a bench test, so opt into AXIS_TEST_MODE
  # exactly as the gate instructs. Debug builds ignore it.
  #
  # WebKitGTK env hardening mirrors smoke-suite.sh's proven launch set:
  # GPU-less runners wedge webview init (DMABUF), lack user namespaces
  # (bubblewrap aborts), and have no GLX (force llvmpipe) — without these
  # the tab window's webview never realizes and the drive fails at "Axis
  # Tab never appeared". NO_AT_BRIDGE skips the a11y-bus lookup that errors
  # on minimal runners. Verification-only launches in a scratch profile.
  setsid env NO_AT_BRIDGE=1 GDK_BACKEND=x11 \
    WEBKIT_FORCE_SANDBOX=0 WEBKIT_DISABLE_COMPOSITING_MODE=1 \
    WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1 \
    AXIS_TEST_MODE=1 "$BIN" >"$APP_LOG" 2>&1 < /dev/null &
  APP_PID=$!
  echo "app: launched pid $APP_PID ($BIN)"

  # ── Main window up? ───────────────────────────────────────────────────────
  if ! wait_win '^Axis$'; then
    echo "FAILED: main window never appeared (${TIMEOUT}s)"
    tail -20 "$APP_LOG" | sed 's/^/    /'
    return 1
  fi
  MAIN=$(xdotool search --name '^Axis$' | head -1)
  focus_win "$MAIN"
  echo "main window: up ($MAIN)"

  # ── Drive the real UI: auth → Ctrl+T → Ctrl+L → URL → Enter ──────────────
  # On a real desktop another window can steal focus mid-sequence (Xvfb never
  # hits this — nothing competes), so the whole drive is retried once with a
  # re-focus in between. Create is asserted per attempt with a short window.
  DRIVE_ATTEMPTS=2
  DRIVE_WAIT=$(( TIMEOUT < 25 ? TIMEOUT : 25 ))
  created=0
  for attempt in $(seq 1 "$DRIVE_ATTEMPTS"); do
    focus_win "$MAIN"
    xdotool type --delay 40 "$CODE"
    xdotool key Return
    sleep 3
    xdotool key --clearmodifiers ctrl+t
    sleep 1
    xdotool key --clearmodifiers ctrl+l
    sleep 0.5
    xdotool type --delay 40 "example.com"
    xdotool key Return
    echo "drive: attempt $attempt — auth + Ctrl+T + navigation sent"
    waited=0
    while [ "$waited" -lt "$DRIVE_WAIT" ]; do
      have_win '^Axis Tab$' && { created=1; break; }
      sleep 1; waited=$((waited + 1))
    done
    [ "$created" = 1 ] && break
    echo "drive: tab window did not appear within ${DRIVE_WAIT}s (attempt $attempt/$DRIVE_ATTEMPTS)"
  done

  # ── Assert CREATE ─────────────────────────────────────────────────────────
  if [ "$created" != 1 ] && ! wait_win '^Axis Tab$'; then
    echo "FAILED: 'Axis Tab' WebviewWindow never appeared (${TIMEOUT}s)"
    grep "axis:tabwin" "$APP_LOG" | sed 's/^/    journal: /'
    tail -15 "$APP_LOG" | sed 's/^/    /'
    return 1
  fi
  TABWIN=$(xdotool search --name '^Axis Tab$' | head -1)
  HELPERS_BEFORE=$(pgrep -fc WebKitWebProcess 2>/dev/null || true); HELPERS_BEFORE=${HELPERS_BEFORE:-0}
  CREATE_LINE=$(grep -oE "create tab-[0-9]+: url=[^ ]+ privileged=[a-z]+ → window live" "$APP_LOG" | tail -1)
  TAB_ID=$(printf '%s' "$CREATE_LINE" | grep -oE "tab-[0-9]+" | grep -oE "[0-9]+")
  if [ -z "$TAB_ID" ]; then
    echo "FAILED: create journal line not found for the live tab window"
    return 1
  fi
  echo "create: OK — X window $TABWIN | journal: $CREATE_LINE"

  # ── Assert CLOSE: Ctrl+W → X window gone + both journal lines ────────────
  # Same focus-race lesson as the drive phase: on a real desktop the WM may
  # hand focus to the freshly-mapped tab window (or another window snipes
  # it), so a single Ctrl+W can land in the tab's own webview — which has no
  # Ctrl+W handler — while the shell never sees it. Retry with re-focus;
  # Xvfb never needs the second attempt.
  CLOSED=0
  for attempt in 1 2 3; do
    focus_win "$MAIN"
    xdotool key --clearmodifiers ctrl+w
    if wait_win_gone '^Axis Tab$'; then
      CLOSED=1
      break
    fi
    echo "close: window persisted after Ctrl+W — refocusing shell (attempt $attempt/3)"
  done
  if [ "$CLOSED" != 1 ]; then
    echo "FAILED: 'Axis Tab' window still on the X server after Ctrl+W (3 attempts × ${TIMEOUT}s)"
    return 1
  fi
  sleep 1
  HELPERS_AFTER=$(pgrep -fc WebKitWebProcess 2>/dev/null || true); HELPERS_AFTER=${HELPERS_AFTER:-0}

  fail=0
  echo "destroy(X): OK — window $TABWIN vanished from the X server"
  if grep -q "close tab-$TAB_ID: destroying WebviewWindow" "$APP_LOG"; then
    echo "close(journal): OK — close tab-$TAB_ID: destroying WebviewWindow"
  else
    echo "FAILED: no 'close tab-$TAB_ID' journal line"; fail=1
  fi
  if grep -q "destroyed tab-$TAB_ID: OS webview window gone, dropping bookkeeping" "$APP_LOG"; then
    echo "destroyed(journal): OK — Tauri WindowEvent::Destroyed fired for real"
  else
    echo "FAILED: no 'destroyed tab-$TAB_ID' journal line"; fail=1
  fi
  echo "evidence: WebKit helper processes before=$HELPERS_BEFORE after=$HELPERS_AFTER"

  # App itself must have survived the tab close.
  if kill -0 "$APP_PID" 2>/dev/null; then
    echo "survivor: OK — main app still alive after tab destroy"
  else
    echo "FAILED: app died during tab close"; fail=1
  fi
  return "$fail"
}

# ── Run inside the chosen display ────────────────────────────────────────────
if [ "$FORCE_XVFB" = 1 ] || [ -z "${DISPLAY:-}" ]; then
  if [ "$IS_INNER" = 1 ]; then
    drive; RC=$?
  else
    command -v xvfb-run >/dev/null 2>&1 ||
      die "headless mode needs xvfb-run (apt install xvfb)"
    echo "verify-live: running headless under Xvfb"
    # Re-invoke self as the inner runner under Xvfb's display. DISPLAY is now
    # set, so the inner takes the direct path; --keep keeps the inner from
    # deleting the shared scratch dir (it returns early anyway).
    INNER_ARGS=(--bin "$BIN")
    [ "$RELEASE" = 1 ] && INNER_ARGS+=(--release)
    INNER_ARGS+=(--code "$CODE" --timeout "$TIMEOUT" --keep)
    AXIS_LIVE_INNER=1 AXIS_LIVE_SCRATCH="$SCRATCH" \
      xvfb-run -a -s "-screen 0 1280x800x24" bash "$0" "${INNER_ARGS[@]}"
    RC=$?
    # Surface the inner app log on failure (outer cleanup keeps the dir).
    [ "$RC" -ne 0 ] && tail -20 "$APP_LOG" 2>/dev/null | sed 's/^/    /'
  fi
else
  drive; RC=$?
fi

echo
if [ "$IS_INNER" = 1 ]; then exit "$RC"; fi
if [ "$RC" -eq 0 ]; then
  echo "VERIFY-LIVE OK: tab window created, closed, and destroyed at the OS level"
else
  echo "VERIFY-LIVE FAILED (exit $RC) — app log: $APP_LOG"
fi
exit "$RC"
