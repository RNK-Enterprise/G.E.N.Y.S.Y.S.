#!/usr/bin/env bash
# GENYSYS™ — one-command verification gate
# Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
#
# Chains the independent checks that guard this codebase:
#   1. audit — global-wiring audit (scripts/audit-window-globals.mjs): every
#              window.* READ has a provider and every bare identifier resolves
#              to one, so an unwired global can never reach a build again.
#   2. loc   — 500 LOC hard-cap audit (scripts/audit-loc.mjs): no hand-written
#              file may exceed the cap; lockfiles/generated catalog are exempt.
#   3. unit  — Jest unit suite (tests/ and src/**/*.test.js), native ESM.
#   3. e2e   — Playwright specs in e2e/ against the Vite dev server; each spec
#              boots GENYSYS and fails on any console error or uncaught throw.
#   4. rust  — cargo test in src-tauri/ through the WebKitGTK pkg-config
#              wrapper (Ubuntu 24.04 ships 4.1; Tauri 1 looks for 4.0 names).
#   5. live  — the compositor-level tab-window proof (scripts/verify-live.sh
#              forced under Xvfb for determinism): launches GENYSYS, drives a real
#              tab open/close, asserts OS-level WebviewWindow destruction via
#              the [genysys:tabwin] journal lines. NOT in the default set: opt in
#              via `npm run verify -- live` (needs xdotool + xvfb). Direct
#              scripts/verify-live.sh runs accept more flags (real display,
#              release binary, etc.).
#   6. loc runs before unit so a cap violation is the cheapest failure.
#
# By default every selected stage runs even if an earlier one fails, so a single
# invocation reports the whole picture; --fail-fast stops at the first failure.
# Stages run cheap → expensive (audit, unit, e2e, rust).
#
# Usage: npm run verify [-- [stage...]] [--fail-fast] [--verbose]
#   stages          subset of: audit unit e2e rust live (default: all but live)
#   -v, --verbose   stream each stage's output live instead of capturing it
#   -h, --help      show this help
#
# Exit codes: 0 = every selected stage passed, 1 = at least one failed,
#             2 = bad usage / missing prerequisite.
# Logs: /tmp/genysys-verify/<stage>.log (override with GENYSYS_VERIFY_LOGDIR).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="${GENYSYS_VERIFY_LOGDIR:-/tmp/genysys-verify}"
ORDER=(audit loc unit e2e rust live)
DEFAULT_STAGES=(audit loc unit e2e rust)

FAIL_FAST=0
VERBOSE=0
declare -a SELECTED=()

usage() { # print the header comment block (up to, excluding, `set -uo pipefail`)
  sed -n '2,/^set -uo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --fail-fast) FAIL_FAST=1 ;;
    -v | --verbose) VERBOSE=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      echo "verify: unknown option '$1' (try --help)" >&2
      exit 2
      ;;
    *)
      SELECTED+=("$1")
      ;;
  esac
  shift
done

if [ "${#SELECTED[@]}" -eq 0 ]; then
  SELECTED=("${DEFAULT_STAGES[@]}")
fi

for want in "${SELECTED[@]}"; do
  found=0
  for known in "${ORDER[@]}"; do [ "$want" = "$known" ] && found=1; done
  if [ "$found" -eq 0 ]; then
    echo "verify: unknown stage '$want' (valid: ${ORDER[*]})" >&2
    exit 2
  fi
done

rm -rf "$LOGDIR"
mkdir -p "$LOGDIR"

PASS=0
FAIL=0
declare -a RESULTS=()

banner() { printf '\n== %s ==\n' "$1"; }

result() { # result <PASS|FAIL> <name> [detail]
  local status=$1 name=$2 detail=${3:-}
  if [ "$status" = PASS ]; then
    PASS=$((PASS + 1))
    RESULTS+=("PASS  $name${detail:+ — $detail}")
  else
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL  $name${detail:+ — $detail}")
  fi
}

report() {
  banner "VERIFY RESULTS"
  local line
  for line in "${RESULTS[@]}"; do echo "  $line"; done
  echo
  if [ "$FAIL" -eq 0 ]; then
    echo "VERIFY OK: $PASS passed, 0 failed"
  else
    echo "VERIFY FAILED: $PASS passed, $FAIL failed"
    echo "logs: $LOGDIR"
  fi
}

# ── Stage bodies ─────────────────────────────────────────────────────────────
stage_audit() { (cd "$ROOT" && npm --silent run audit:globals); }
stage_loc() { (cd "$ROOT" && node scripts/audit-loc.mjs); }
stage_unit() { (cd "$ROOT" && npm --silent run test); }
stage_e2e() { (cd "$ROOT" && npm --silent run test:e2e); }
stage_rust() { (cd "$ROOT/src-tauri" && bash "$ROOT/scripts/with-webkit-pc.sh" cargo test); }
stage_live() { bash "$ROOT/scripts/verify-live.sh" --xvfb; }  # forced Xvfb: deterministic, WM-less-safe

stage_label() {
  case "$1" in
    audit) echo "global-wiring audit" ;;
    loc) echo "500 LOC cap audit" ;;
    unit) echo "jest unit tests" ;;
    e2e) echo "playwright e2e" ;;
    rust) echo "cargo test" ;;
    live) echo "live tab-window proof (compositor)" ;;
  esac
}

# Prerequisites that would otherwise fail with a cryptic error.
stage_preflight() {
  case "$1" in
    audit | loc | unit | e2e)
      [ -d "$ROOT/node_modules" ] || { echo "node_modules missing — run npm install" >&2; return 1; }
      ;;
    rust)
      command -v cargo >/dev/null 2>&1 || { echo "cargo not on PATH" >&2; return 1; }
      # Tauri's generate_context! proc macro validates distDir (`../dist`)
      # at COMPILE time. Without a frontend build, cargo test dies in a
      # cryptic proc-macro panic — fail fast with the remedy instead.
      if [ ! -f "$ROOT/dist/index.html" ]; then
        echo "dist/ missing — Tauri's generate_context! validates distDir at compile time." >&2
        echo "  Run 'npm run build:vite' first (or 'npm run verify -- audit unit e2e live' — CI's ci-verify.sh does this automatically)." >&2
        return 1
      fi
      ;;
    live)
      for t in xdotool xvfb-run; do
        command -v "$t" >/dev/null 2>&1 || { echo "live stage needs '$t' (apt install xdotool xvfb)" >&2; return 1; }
      done
      ;;
  esac
  return 0
}

# One-line evidence pulled from the stage log (best effort, never fatal).
stage_detail() {
  local log="$LOGDIR/$1.log"
  [ -s "$log" ] || return 0
  case "$1" in
    audit)
      grep -oE '[0-9]+ files, [0-9]+ window\.\* names \([0-9]+ reads, [0-9]+ writes/deletes\)' "$log" | tail -1
      ;;
    loc)
      grep -oE '[0-9,]+ files, [0-9,]+ LOC, cap [0-9]+' "$log" | tail -1
      ;;
    unit)
      grep -E '^Tests:' "$log" | tail -1 | sed 's/^Tests: *//'
      ;;
    e2e)
      grep -oE '[0-9]+ passed \([0-9.]+m?s\)' "$log" | tail -1 ||
        grep -oE '[0-9]+ passed' "$log" | tail -1
      ;;
    rust)
      grep -oE 'test result: ok\. [0-9]+ passed' "$log" |
        grep -oE '[0-9]+' |
        awk '{s += $1} END {if (s > 0) print s " tests passed"}'
      ;;
    live)
      # Echo the strongest line of evidence: OS-level destroy confirmation.
      {
        grep -oE 'create tab-[0-9]+: url=[^ ]+ .*' "$log" | tail -1
        grep -E '^destroyed\(journal\): OK' "$log" | tail -1
      } | paste -sd' · ' -
      ;;
  esac
}

run_stage() { # <stage>
  local key=$1
  local label; label="$(stage_label "$key")"
  local log="$LOGDIR/$key.log"
  local start=$SECONDS
  local rc=0

  banner "$label ($key)"

  if ! stage_preflight "$key" >"$log" 2>&1; then
    result FAIL "$label" "prerequisite missing — $(tail -1 "$log")"
    if [ "$FAIL_FAST" = 1 ]; then report; exit 1; fi
    return 0
  fi

  if [ "$VERBOSE" = 1 ]; then
    "stage_$key" 2>&1 | tee "$log"
    rc=${PIPESTATUS[0]}
  else
    "stage_$key" >"$log" 2>&1
    rc=$?
  fi

  local dur=$((SECONDS - start))
  if [ "$rc" -eq 0 ]; then
    result PASS "$label" "$(stage_detail "$key") (${dur}s)"
  else
    result FAIL "$label" "exit $rc in ${dur}s — $log"
    echo
    echo "--- last 20 lines of $log ---"
    tail -n 20 "$log" | sed 's/^/    /'
    echo "---"
    if [ "$FAIL_FAST" = 1 ]; then report; exit 1; fi
  fi
  return 0
}

# ── Run ──────────────────────────────────────────────────────────────────────
echo "GENYSYS verify — $ROOT"
echo "stages: ${SELECTED[*]}  |  logs: $LOGDIR"

for key in "${ORDER[@]}"; do
  for want in "${SELECTED[@]}"; do
    if [ "$want" = "$key" ]; then
      run_stage "$key"
      break
    fi
  done
done

report
[ "$FAIL" -eq 0 ] || exit 1
exit 0
