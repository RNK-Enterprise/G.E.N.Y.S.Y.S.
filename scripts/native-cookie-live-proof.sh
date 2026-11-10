#!/usr/bin/env bash
# GENYSYS native-cookie live proof (Linux WebKitGTK / Windows WebView2 / macOS WKWebView).
#
# Builds the feature-gated proof window, starts a loopback HTTPS probe with a
# fresh self-signed certificate, then checks:
#   - /first receives genysys_attest on the first request;
#   - document.cookie cannot see it (HttpOnly);
#   - a cross-site POST still sends it (SameSite=None + Secure);
#   - /after receives no cookie after clear.
#
# Usage: npm run proof:native-cookie [-- --negative|--samesite=lax|--domain]
# The negative mode writes SameSite=Lax and expects the cross-site check to
# fail while the other checks stay green. The domain mode seeds
# `.rnk-enterprise.us` with SameSite=None and invokes the unmodified production
# clear path, then reads the real cookie jar back.
#
# Requirements: Node 22+, npm, Rust, OpenSSL. macOS additionally installs the
# temporary certificate in the login keychain; Windows uses WebView2's local
# `--ignore-certificate-errors` flag on the proof window only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OS="$(uname -s)"
case "$OS" in
  Darwin | Linux | MINGW* | MSYS* | CYGWIN*) ;;
  *)
    echo "native-cookie-live-proof: run this on Linux, Windows, or macOS (found $OS)" >&2
    exit 2
    ;;
esac

for tool in node npm cargo openssl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "native-cookie-live-proof: missing $tool" >&2
    exit 2
  fi
done

if [ "$OS" = "Linux" ] && [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
  echo "native-cookie-live-proof: Linux needs a graphical session (DISPLAY or WAYLAND_DISPLAY)" >&2
  exit 2
fi

case "${1:-}" in
  '' | --positive) MODE=positive ;;
  --negative | --samesite=lax) MODE=negative ;;
  --domain | --production-domain) MODE=domain ;;
  *)
    echo "usage: npm run proof:native-cookie -- [--negative|--samesite=lax|--domain]" >&2
    exit 2
    ;;
esac
if [ "$MODE" = negative ]; then
  SAMESITE=Lax
else
  SAMESITE=None
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/genysys-cookie-proof.XXXXXX")"
SERVER_PID=""
APP_PID=""
TRUSTED=0
KEYCHAIN=""
CERT="$TMP/cert.pem"

cleanup() {
  if [ -n "$APP_PID" ]; then kill "$APP_PID" >/dev/null 2>&1 || true; fi
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" >/dev/null 2>&1 || true; fi
  if [ "$TRUSTED" = 1 ]; then
    security remove-trusted-cert "$CERT" >/dev/null 2>&1 || true
    local fingerprint
    fingerprint="$(openssl x509 -in "$CERT" -noout -fingerprint -sha1 2>/dev/null | cut -d= -f2 | tr -d ':')"
    if [ -n "$fingerprint" ]; then
      security delete-certificate -Z "$fingerprint" "$KEYCHAIN" >/dev/null 2>&1 || true
    fi
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

cat >"$TMP/openssl.cnf" <<'EOF'
[req]
prompt = no
distinguished_name = dn
x509_extensions = v3
[dn]
CN = GENYSYS Native Cookie Proof
[v3]
subjectAltName = DNS:localhost, IP:127.0.0.1
basicConstraints = critical, CA:TRUE
keyUsage = critical, digitalSignature, keyEncipherment, keyCertSign
extendedKeyUsage = serverAuth
EOF

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 2 \
  -config "$TMP/openssl.cnf" -keyout "$TMP/key.pem" -out "$CERT" >/dev/null 2>&1

if [ "$OS" = "Darwin" ]; then
  KEYCHAIN="${HOME}/Library/Keychains/login.keychain-db"
  if ! security add-trusted-cert -r trustRoot -p ssl -k "$KEYCHAIN" "$CERT" >/dev/null; then
    echo "native-cookie-live-proof: could not trust the temporary certificate in $KEYCHAIN" >&2
    exit 2
  fi
  TRUSTED=1
fi

TOKEN="proof.$(openssl rand -hex 16).sig"
GENYSYS_COOKIE_PROOF_TOKEN="$TOKEN" \
GENYSYS_COOKIE_PROOF_SAMESITE="$SAMESITE" \
  node "$ROOT/scripts/native-cookie-live-proof-server.mjs" "$TMP" \
  >"$TMP/server.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 100); do
  if [ -f "$TMP/server.json" ]; then break; fi
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    cat "$TMP/server.log" >&2
    exit 1
  fi
  sleep 0.1
done
if [ ! -f "$TMP/server.json" ]; then
  echo "native-cookie-live-proof: probe server did not start" >&2
  cat "$TMP/server.log" >&2
  exit 1
fi
PORT="$(node -e 'process.stdout.write(String(JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).port))' "$TMP/server.json")"
BOOT_PORT="$(node -e 'process.stdout.write(String(JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).bootPort))' "$TMP/server.json")"
START_URL=""
if [ "$OS" = "Linux" ]; then
  if [ "$MODE" = domain ]; then
    START_URL="http://127.0.0.1:$BOOT_PORT/domain"
  else
    START_URL="http://127.0.0.1:$BOOT_PORT/boot"
  fi
fi

(cd "$ROOT" && npm --silent run build:vite)
if [ "$OS" = "Linux" ]; then
  (cd "$ROOT" && bash scripts/with-webkit-pc.sh cargo build --manifest-path src-tauri/Cargo.toml --features native-cookie-live-proof)
else
  (cd "$ROOT" && cargo build --manifest-path src-tauri/Cargo.toml --features native-cookie-live-proof)
fi

BIN="$ROOT/src-tauri/target/debug/rnk-genysys"
if [ -f "$BIN.exe" ]; then BIN="$BIN.exe"; fi
if [ ! -x "$BIN" ] && [ ! -f "$BIN" ]; then
  echo "native-cookie-live-proof: proof binary not found at $BIN" >&2
  exit 1
fi

if [ "$MODE" = domain ]; then
  GENYSYS_NATIVE_COOKIE_PROOF=1 \
  GENYSYS_COOKIE_PROOF_URL="https://localhost:$PORT" \
  GENYSYS_COOKIE_PROOF_START_URL="$START_URL" \
  GENYSYS_COOKIE_PROOF_SAMESITE="$SAMESITE" \
  GENYSYS_COOKIE_PROOF_DOMAIN_PROOF=1 \
  GENYSYS_COOKIE_PROOF_DOMAIN_REPORT="$TMP/domain-report.json" \
  GENYSYS_COOKIE_PROOF_TOKEN="$TOKEN" \
    "$BIN" >"$TMP/app.log" 2>&1 &
else
  GENYSYS_NATIVE_COOKIE_PROOF=1 \
  GENYSYS_COOKIE_PROOF_URL="https://localhost:$PORT" \
  GENYSYS_COOKIE_PROOF_START_URL="$START_URL" \
  GENYSYS_COOKIE_PROOF_SAMESITE="$SAMESITE" \
  GENYSYS_COOKIE_PROOF_DOMAIN="localhost" \
  GENYSYS_COOKIE_PROOF_TOKEN="$TOKEN" \
    "$BIN" >"$TMP/app.log" 2>&1 &
fi
APP_PID=$!

if [ "$MODE" = domain ]; then
  set +e
  wait "$APP_PID"
  APP_STATUS=$?
  set -e
  APP_PID=""
  kill "$SERVER_PID" >/dev/null 2>&1 || true
  SERVER_PID=""
  echo
  echo "=== native cookie production-domain proof ==="
  if [ -f "$TMP/domain-report.json" ]; then cat "$TMP/domain-report.json"; fi
  if [ "$APP_STATUS" -ne 0 ]; then
    echo
    echo "=== app log ==="
    cat "$TMP/app.log"
  fi
  if [ ! -f "$TMP/domain-report.json" ]; then
    echo "native-cookie-live-proof: domain report missing" >&2
    exit 1
  fi
  if ! node -e 'const r=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); process.exit(r.pass ? 0 : 1)' "$TMP/domain-report.json"; then
    exit 1
  fi
  exit 0
fi

set +e
wait "$SERVER_PID"
SERVER_STATUS=$?
set -e
SERVER_PID=""

echo
echo "=== native cookie proof ($MODE, SameSite=$SAMESITE) ==="
if [ -f "$TMP/report.json" ]; then cat "$TMP/report.json"; fi
if [ "$SERVER_STATUS" -ne 0 ]; then
  echo
  echo "=== app log ==="
  cat "$TMP/app.log"
fi
exit "$SERVER_STATUS"
