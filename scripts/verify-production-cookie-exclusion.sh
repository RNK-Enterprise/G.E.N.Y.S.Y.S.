#!/usr/bin/env bash
# Confirm the production build does not compile the native-cookie proof.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/src-tauri/target/debug/rnk-genysys"
if [ "$(uname -s)" = "Darwin" ] || [ -n "${MSYSTEM:-}" ]; then
  echo "verify-production-cookie-exclusion: run on Linux (needs the WebKitGTK wrapper)" >&2
  exit 2
fi

(cd "$ROOT" && bash scripts/with-webkit-pc.sh cargo build --manifest-path src-tauri/Cargo.toml)

if [ ! -f "$BIN" ]; then
  echo "verify-production-cookie-exclusion: binary not found at $BIN" >&2
  exit 1
fi

STRINGS="$(mktemp)"
trap 'rm -f "$STRINGS"' EXIT
strings -a "$BIN" >"$STRINGS"

# RemoteDomainAccessScope is a type name in Tauri's own scope module even
# without the proof. These markers exist only when our proof code compiles.
for marker in native-cookie-proof GENYSYS_COOKIE_PROOF run_production_domain_proof native_cookie_proof 'https://localhost'; do
  if grep -Fq "$marker" "$STRINGS"; then
    echo "verify-production-cookie-exclusion: production binary contains $marker" >&2
    exit 1
  fi
done

if ! grep -Fq ".rnk-enterprise.us" "$STRINGS"; then
  echo "verify-production-cookie-exclusion: production domain missing from binary" >&2
  exit 1
fi

echo "verify-production-cookie-exclusion: production binary has no proof module, IPC scope, or domain override"
