# VEIL tooling and verification scripts

Entry points: `verify.sh` (full gate), `verify-live.sh` (compositor-level proof), `ci-verify.sh` (CI chain), `smoke-suite.sh` (package smoke tests).

Utilities: `split-main.mjs` + `split-main-engine.mjs` (the one-time main.js module split; recipes + AST engine), `audit-window-globals.mjs`, `generate-veil-catalog.mjs`, `with-webkit-pc.sh` (WebKitGTK pkg-config wrapper for non-Fedora hosts).

`.split-shared-names.json` is data for the split tooling, not a config file.
