#!/usr/bin/env bash
# GENYSYS — CI-style smoke suite: build all three artifacts, verify contents,
# and launch-verify the AppImage + deb binary headlessly (Xvfb).
#
# What "green" means here (every phase must PASS, else exit 1):
#   1. Frontend builds (vite) and the prod bundle contains no dev bypass.
#   2. Rust unit tests pass (fail-closed policy, command session, tab gates).
#   3. All three artifacts exist and are FRESH: embedded binaries must be
#      byte-identical to the current release build.
#   4. deb: dependencies are installable (no phantom libwebkit2gtk-4.0-37)
#      and the .desktop entry validates.
#   5. rpm: payload integrity via embedded RPM header tags (rpm tool optional).
#   6. AppImage: type-1 magic + squashfs listing (no extraction).
#   7. Launch-verify: AppImage AND deb binary boot under Xvfb, print the
#      P.R.O.T.E.C.T.S. banner and hold the fail-closed gate without
#      COMMAND_URL; a dev binary must NOT print the HOLD line.
#   8. Gate flip works: with GENYSYS_TEST_MODE=1 the HOLD is absent.
#
# Usage: bash scripts/smoke-suite.sh [--skip-build]
#   --skip-build  verify existing artifacts only (they must still be fresh).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE="$ROOT/src-tauri/target/release/bundle"
DEB="$BUNDLE/deb/genysys_0.1.0_amd64.deb"
RPM="$BUNDLE/rpm/genysys-0.1.0-1.x86_64.rpm"
APPDIR="$BUNDLE/appimage/genysys.AppDir"
APPIMAGE="$BUNDLE/appimage/genysys_0.1.0_amd64.AppImage"
BIN="$ROOT/src-tauri/target/release/genysys"
LOGDIR=$(mktemp -d)
# Keep logs for CI diagnostics when the suite fails (dumped inline below and
# by the workflow's log-dump step); cleaned up on success.
cleanup_logs() { [ "$FAIL" -eq 0 ] && rm -rf "$LOGDIR" || true; }
trap cleanup_logs EXIT

PASS=0
FAIL=0
declare -a RESULTS

result() { # result <PASS|FAIL> <name> [detail]
  local status=$1 name=$2 detail=${3:-}
  if [ "$status" = "PASS" ]; then
    PASS=$((PASS + 1)); RESULTS+=("PASS  $name ${detail:+— $detail}")
  else
    FAIL=$((FAIL + 1)); RESULTS+=("FAIL  $name ${detail:+— $detail}")
  fi
}

# Launch a binary headlessly and capture output. Budget is generous: a cold
# 2-core CI runner needs xvfb startup + GTK + WebKitGTK init before the app
# prints its banner (8s was fine on desktops, silent-death on runners).
# NO_AT_BRIDGE skips the a11y-bus lookup that errors on minimal runners.
# WEBKIT_FORCE_SANDBOX=0: GH runners disable unprivileged user namespaces,
# so WebKitGTK's bubblewrap sandbox aborts the process before main() prints
# anything. Verification-only launches; this says nothing about shipped use.
# WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1: newer WebKitGTK ignores the
# legacy var above and demands this one instead (verified in CI); old builds
# ignore the new var. Setting both covers either generation.
# WEBKIT_DISABLE_DMABUF_RENDERER=1: GPU-less runners make WebKitGTK ≥ 2.40's
# DMABUF renderer kill the process during webview init — before Tauri's setup
# hook (where the banner prints) ever runs, so the app dies with zero output.
# LIBGL_ALWAYS_SOFTWARE: xvfb has no GLX; force Mesa llvmpipe.
# usage: launch_capture <logfile> <secs> <binary> [args...]
launch_capture() {
  local log=$1 secs=$2 bin=$3; shift 3
  if command -v xvfb-run >/dev/null 2>&1; then
    timeout "$secs" xvfb-run -a env NO_AT_BRIDGE=1 GDK_BACKEND=x11 \
      WEBKIT_FORCE_SANDBOX=0 WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 \
      WEBKIT_DISABLE_COMPOSITING_MODE=1 \
      WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1 \
      "$bin" "$@" >"$log" 2>&1
  else
    echo "(no xvfb-run on PATH — launching without X; GTK will fail fast)" >&2
    env -u DISPLAY -u WAYLAND_DISPLAY NO_AT_BRIDGE=1 timeout "$secs" "$bin" "$@" >"$log" 2>&1
  fi
  return 0
}

check_banner_and_hold() { # <logfile> <expect_hold:0|1>
  local log=$1 expect_hold=$2
  grep -q "P.R.O.T.E.C.T.S. mode" "$log" || return 1
  if [ "$expect_hold" = "1" ]; then
    grep -q "FAIL-CLOSED HOLD" "$log" || return 1
    grep -q "without COMMAND_URL" "$log" || return 1
  else
    grep -q "FAIL-CLOSED HOLD" "$log" && return 1
  fi
  return 0
}

banner() { printf '\n== %s ==\n' "$1"; }

# FAIL detail from a launch log — with an explicit hint when the log is empty
# (process killed during GTK/WebKit init, before the banner could print).
loghead() {
  if [ -s "$1" ]; then head -2 "$1" | tr '\n' ' '; else echo "(no output — died before banner; see launch log dumps)"; fi
}

# ── Phase 1: frontend build + no-dev-bypass in the prod bundle ────────────────
banner "Phase 1: frontend build"
if (cd "$ROOT" && npm run build:vite >/dev/null 2>&1); then
  result PASS "vite build (with global-wiring audit gate)"
else
  result FAIL "vite build"
fi
if (cd "$ROOT" && grep -rq "genysys_dev_bypass" dist/assets/ 2>/dev/null); then
  result FAIL "no dev bypass in prod bundle"
else
  result PASS "no dev bypass in prod bundle"
fi

# ── Phase 2: Rust unit tests ─────────────────────────────────────────────────
banner "Phase 2: rust tests"
if (cd "$ROOT/src-tauri" && bash ../scripts/with-webkit-pc.sh cargo test >/tmp/genysys-smoke-test.log 2>&1); then
  n=$(grep -oE "test result: ok\. [0-9]+ passed" /tmp/genysys-smoke-test.log | grep -oE "[0-9]+" | head -1)
  result PASS "cargo test" "${n:-?} passed"
else
  result FAIL "cargo test" "see /tmp/genysys-smoke-test.log"
fi

# ── Phase 3: build artifacts (unless --skip-build) ───────────────────────────
if [ "${1:-}" = "--skip-build" ]; then
  banner "Phase 3: artifacts (skipped build)"
  result PASS "build skipped by flag"
else
  banner "Phase 3: build artifacts"
  if (cd "$ROOT" && bash scripts/build-appimage.sh >/tmp/genysys-smoke-build.log 2>&1); then
    result PASS "build-appimage.sh (deb + rpm + AppImage)"
  else
    result FAIL "build-appimage.sh" "see /tmp/genysys-smoke-build.log"
  fi
fi

# ── Phase 4: deb integrity ───────────────────────────────────────────────────
banner "Phase 4: deb integrity"
if [ -f "$DEB" ]; then result PASS "deb exists"; else result FAIL "deb exists"; fi
if [ -f "$DEB" ]; then
  deps=$(dpkg-deb -f "$DEB" Depends)
  if echo "$deps" | grep -q "libwebkit2gtk-4\.0-37"; then
    result FAIL "deb has no phantom webkit 4.0 dep" "$deps"
  else
    result PASS "deb has no phantom webkit 4.0 dep" "$deps"
  fi
fi
if [ -f "$DEB" ]; then
  WORK=$(mktemp -d)
  dpkg-deb -R "$DEB" "$WORK/pkg" 2>/dev/null
  bin_md5=$(md5sum "$WORK/pkg/usr/bin/genysys" 2>/dev/null | cut -d' ' -f1)
  cur_md5=$(md5sum "$BIN" 2>/dev/null | cut -d' ' -f1)
  if [ -n "$bin_md5" ] && [ "$bin_md5" = "$cur_md5" ]; then
    result PASS "deb binary is fresh (md5 match)"
  else
    result FAIL "deb binary is fresh (md5 match)" "$bin_md5 vs $cur_md5"
  fi
  if desktop-file-validate "$WORK/pkg/usr/share/applications/genysys.desktop" >/dev/null 2>&1; then
    result PASS "genysys.desktop validates"
  else
    result FAIL "genysys.desktop validates"
  fi
  rm -rf "$WORK"
fi

# ── Phase 5: rpm integrity (rpm tool optional) ───────────────────────────────
banner "Phase 5: rpm integrity"
if [ ! -f "$RPM" ]; then
  result FAIL "rpm exists"
else
  result PASS "rpm exists"
  # Prefer the pure-python extraction (no rpm tooling at all — the same
  # code path on every runner); fall back to rpm2cpio when python3 is
  # absent. Both verify the embedded binary's md5 against the fresh build.
  if command -v python3 >/dev/null 2>&1; then
    if RPM="$RPM" BIN="$BIN" python3 - << 'PYEOF'
import os, sys, zlib, lzma, hashlib
rpm, binpath = os.environ["RPM"], os.environ["BIN"]
data = open(rpm, "rb").read()
assert data[:4] == b"\xed\xab\xee\xdb", "not an rpm"
xs, gs = data.find(b"\xfd7zXZ\x00", 96), data.find(b"\x1f\x8b", 96)
start = min(o for o in (xs, gs) if o != -1)
comp = data[start:]
raw = (lzma.LZMADecompressor().decompress(comp) if start == xs
       else zlib.decompress(comp, 16 + zlib.MAX_WBITS))
i, found = 0, None
while i + 110 <= len(raw):
    if raw[i:i+6] != b"070701": break
    f = [int(raw[i+6+j*8:i+14+j*8], 16) for j in range(13)]
    fsize, namesize = f[6], f[11]
    name = raw[i+110:i+110+namesize-1].decode(errors="replace")
    he = (i + 110 + namesize + 3) & ~3
    if name in ("usr/bin/genysys", "./usr/bin/genysys"):
        found = raw[he:he+fsize]
    i = (he + fsize + 3) & ~3
    if name == "TRAILER!!!": break
if found is None:
    sys.exit(3)
sys.exit(0 if hashlib.md5(found).hexdigest() == hashlib.md5(open(binpath, "rb").read()).hexdigest() else 2)
PYEOF
    then
      result PASS "rpm binary is fresh (md5 match)" "(python payload extraction)"
    else
      rc=$?
      case $rc in
        2) result FAIL "rpm binary is fresh (md5 match)" "embedded md5 != built $BIN" ;;
        3) result FAIL "rpm binary is fresh (md5 match)" "usr/bin/genysys not found in payload" ;;
        *) result FAIL "rpm binary is fresh (md5 match)" "payload decode failed (rc=$rc)" ;;
      esac
    fi
  elif command -v rpm2cpio >/dev/null 2>&1; then
    W=$(mktemp -d)
    # Extract everything, keep cpio's stderr: rpm payload paths are stored
    # WITHOUT a leading ./ on some bundlers and WITH it (./usr/bin/genysys) on
    # tauri 1.6, so a name filter silently matches nothing. On a mismatch the
    # detail reports both md5s so the next run is diagnosable, not a mystery.
    if rpm2cpio "$RPM" 2>"$W/cpio.err" | (cd "$W" && cpio -idm --quiet 2>>"$W/cpio.err"); then
      if [ ! -f "$W/usr/bin/genysys" ]; then
        result FAIL "rpm binary is fresh (md5 match)" "usr/bin/genysys not extracted — $(tail -1 "$W/cpio.err" 2>/dev/null)"
      else
        emb=$(md5sum "$W/usr/bin/genysys" | cut -d' ' -f1)
        cur=$(md5sum "$BIN" | cut -d' ' -f1)
        if [ "$emb" = "$cur" ]; then
          result PASS "rpm binary is fresh (md5 match)"
        else
          result FAIL "rpm binary is fresh (md5 match)" "embedded $emb != built $cur"
        fi
      fi
    else
      result FAIL "rpm binary is fresh (md5 match)" "extraction failed — $(tail -1 "$W/cpio.err" 2>/dev/null)"
    fi
    rm -rf "$W"
  else
    # rpm2cpio unavailable: pure-python payload extraction. (A grep for the
    # path string can never work — the cpio payload is gzip/xz compressed,
    # so the name listing is invisible in the raw file.)
    if command -v python3 >/dev/null 2>&1; then
      if RPM="$RPM" BIN="$BIN" python3 - << 'PYEOF'
import os, sys, zlib, lzma, hashlib
rpm, binpath = os.environ["RPM"], os.environ["BIN"]
data = open(rpm, "rb").read()
assert data[:4] == b"\xed\xab\xee\xdb", "not an rpm"
xs, gs = data.find(b"\xfd7zXZ\x00", 96), data.find(b"\x1f\x8b", 96)
start = min(o for o in (xs, gs) if o != -1)
comp = data[start:]
raw = (lzma.LZMADecompressor().decompress(comp) if start == xs
       else zlib.decompress(comp, 16 + zlib.MAX_WBITS))
i, found = 0, None
while i + 110 <= len(raw):
    if raw[i:i+6] != b"070701": break
    f = [int(raw[i+6+j*8:i+14+j*8], 16) for j in range(13)]
    fsize, namesize = f[6], f[11]
    name = raw[i+110:i+110+namesize-1].decode(errors="replace")
    he = (i + 110 + namesize + 3) & ~3
    if name in ("usr/bin/genysys", "./usr/bin/genysys"):
        found = raw[he:he+fsize]
    i = (he + fsize + 3) & ~3
    if name == "TRAILER!!!": break
if found is None:
    sys.exit(3)
sys.exit(0 if hashlib.md5(found).hexdigest() == hashlib.md5(open(binpath, "rb").read()).hexdigest() else 2)
PYEOF
      then
        result PASS "rpm payload contains usr/bin/genysys" "(python extraction, md5 match)"
      else
        rc=$?
        case $rc in
          2) result FAIL "rpm payload contains usr/bin/genysys" "binary md5 mismatch vs $BIN" ;;
          3) result FAIL "rpm payload contains usr/bin/genysys" "usr/bin/genysys not found in payload" ;;
          *) result FAIL "rpm payload contains usr/bin/genysys" "payload decode failed (rc=$rc)" ;;
        esac
      fi
    else
      result FAIL "rpm payload contains usr/bin/genysys" "no rpm2cpio and no python3 — cannot verify"
    fi
  fi
fi

# ── Phase 6: AppImage integrity (no extraction) ───────────────────────────────
banner "Phase 6: AppImage integrity"
if [ -f "$APPIMAGE" ]; then result PASS "AppImage exists"; else result FAIL "AppImage exists"; fi
if [ -f "$APPIMAGE" ]; then
  magic=$(head -c 4 "$APPIMAGE" | od -An -tx1 | tr -d ' \n')
  if [ "$magic" = "7f454c46" ]; then
    result PASS "AppImage type-1 magic (ELF)"
  else
    result FAIL "AppImage type-1 magic (ELF)" "$magic"
  fi
  # ISO9660 signature at offset 0x8001 (type-1 AppImage = ELF + appended ISO);
  # type-2 (modern appimagetool) is ELF + compressed squashfs (hsqs magic).
  sig=$(dd if="$APPIMAGE" bs=1 skip=32769 count=5 2>/dev/null)
  if [ "$sig" = "CD001" ]; then
    result PASS "AppImage payload signature (CD001 ISO)"
  elif grep -aqs "hsqs" "$APPIMAGE"; then
    result PASS "AppImage payload signature (squashfs, type-2)"
  else
    result FAIL "AppImage payload signature" "neither CD001 nor squashfs magic"
  fi
  # Directory listing: type-1 images have a plain ISO filesystem (isoinfo);
  # type-2 (modern appimagetool) embeds a compressed squashfs, so strings are
  # invisible to grep — extract via the runtime instead (no FUSE needed).
  if command -v isoinfo >/dev/null 2>&1 && [ "$sig" = "CD001" ]; then
      if isoinfo -i "$APPIMAGE" -R 2>/dev/null | grep -q "genysys.AppDir/usr/bin/genysys"; then
        result PASS "AppImage payload lists usr/bin/genysys"
      else
        result FAIL "AppImage payload lists usr/bin/genysys"
      fi
    else
      W=$(mktemp -d)
      if (cd "$W" && HOME="$W" timeout 60 "$APPIMAGE" --appimage-extract >/dev/null 2>&1) \
         && [ -f "$W/squashfs-root/usr/bin/genysys" ]; then
        result PASS "AppImage payload lists usr/bin/genysys" "(type-2 squashfs — runtime extraction)"
      else
        result FAIL "AppImage payload lists usr/bin/genysys"
      fi
      rm -rf "$W"
    fi
fi

# ── Phase 7: headless launch-verify (AppImage + deb binary) ───────────────────
banner "Phase 7: headless launch verification"
# For AppImage extraction mode we must point HOME somewhere writable.
if [ -f "$APPIMAGE" ]; then
  chmod +x "$APPIMAGE"
  HOME_SAVED=$HOME
  HOME=/tmp
  launch_capture "$LOGDIR/appimage.log" 20 env APPIMAGE_EXTRACT_AND_RUN=1 "$APPIMAGE"
  # Extract-and-run can swallow the inner app's stdout (and was empty on CI
  # even after the fallback); pre-extract once and run the payload's AppRun
  # directly — same bytes, plain execution, no nested extraction per launch.
  if [ ! -s "$LOGDIR/appimage.log" ]; then
    EX=$(mktemp -d)
    (cd "$EX" && timeout 120 "$APPIMAGE" --appimage-extract >/dev/null 2>&1)
    if [ -x "$EX/squashfs-root/AppRun" ]; then
      launch_capture "$LOGDIR/appimage.log" 20 env HOME=/tmp "$EX/squashfs-root/AppRun"
    elif [ -x "$APPDIR/AppRun" ]; then
      launch_capture "$LOGDIR/appimage.log" 20 env HOME=/tmp "$APPDIR/AppRun"
    fi
    rm -rf "$EX"
  elif [ -x "$APPDIR/AppRun" ] && [ ! -s "$LOGDIR/appimage.log" ]; then
    launch_capture "$LOGDIR/appimage.log" 20 env HOME=/tmp "$APPDIR/AppRun"
  fi
  HOME=$HOME_SAVED
  if [ -s "$LOGDIR/appimage.log" ]; then
    if check_banner_and_hold "$LOGDIR/appimage.log" 1; then
      result PASS "AppImage boots and holds fail-closed gate"
    else
      result FAIL "AppImage boots and holds fail-closed gate" "$(loghead "$LOGDIR/appimage.log")"
    fi
  else
    result FAIL "AppImage boots and holds fail-closed gate" "no output captured"
  fi
else
  result FAIL "AppImage boots and holds fail-closed gate" "artifact missing"
fi

if [ -x "$BIN" ]; then
  # Production behavior: bare launch (no bench env) → HOLD expected.
  launch_capture "$LOGDIR/bin.log" 20 env -u GENYSYS_TEST_MODE "$BIN"
  if check_banner_and_hold "$LOGDIR/bin.log" 1; then
    result PASS "release binary boots and holds fail-closed gate"
  else
    result FAIL "release binary boots and holds fail-closed gate" "$(loghead "$LOGDIR/bin.log")"
  fi
  # Gate flip: with GENYSYS_TEST_MODE=1 the HOLD must be absent.
  launch_capture "$LOGDIR/bin-bench.log" 20 env GENYSYS_TEST_MODE=1 "$BIN"
  if grep -q "FAIL-CLOSED HOLD" "$LOGDIR/bin-bench.log"; then
    result FAIL "bench mode suppresses HOLD" "GENYSYS_TEST_MODE=1 still printed HOLD"
  else
    result PASS "bench mode suppresses HOLD"
  fi
else
  result FAIL "release binary boots and holds fail-closed gate" "binary missing"
fi

# Same for the installed package binary if present.
if [ -x /usr/bin/genysys ]; then
  launch_capture "$LOGDIR/installed.log" 20 /usr/bin/genysys
  if check_banner_and_hold "$LOGDIR/installed.log" 1; then
    result PASS "installed /usr/bin/genysys boots and holds fail-closed gate"
  else
    result FAIL "installed /usr/bin/genysys boots and holds fail-closed gate" "$(loghead "$LOGDIR/installed.log")"
  fi
fi

# ── Report ────────────────────────────────────────────────────────────────────
# On failure, dump the launch logs inline — the workflow-level log-dump step
# runs after the suite, so any trap-based cleanup must not have eaten them.
if [ "$FAIL" -ne 0 ]; then
  banner "LAUNCH LOG DUMPS (failure diagnostics)"
  for f in "$LOGDIR"/*.log; do
    [ -f "$f" ] || continue
    echo "--- $f ($(wc -c <"$f") bytes) ---"
    tail -20 "$f"
  done
fi

banner "SMOKE RESULTS"
for line in "${RESULTS[@]}"; do echo "  $line"; done
echo
if [ "$FAIL" -eq 0 ]; then
  echo "SMOKE OK: $PASS passed, 0 failed"
  exit 0
else
  echo "SMOKE FAILED: $PASS passed, $FAIL failed"
  exit 1
fi
