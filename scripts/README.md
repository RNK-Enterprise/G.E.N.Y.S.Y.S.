# GENYSYS tooling and verification scripts

Entry points: `verify.sh` (full gate), `verify-live.sh` (compositor-level WebKit proof), `camofox-tauri-proof.sh` (Camofox backend shell proof under Xvfb; requires live Camofox+noVNC), `ci-verify.sh` (CI chain), `smoke-suite.sh` (package smoke tests).

Utilities: `camofox-live-proof.mjs` (live Camofox hop-by-hop redirect refusal, attestation cookie import, and noVNC readiness against a local Camofox instance; default `http://127.0.0.1:9378`), `split-main.mjs` + `split-main-engine.mjs` (the one-time main.js module split; recipes + AST engine), `audit-window-globals.mjs`, `generate-genysys-catalog.mjs`, `with-webkit-pc.sh` (WebKitGTK pkg-config wrapper for non-Fedora hosts).

`.split-shared-names.json` is data for the split tooling, not a config file.
