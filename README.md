<p align="center"><img src="veil-icon.svg" width="96" alt="V.E.I.L. icon"></p>

# V.E.I.L. — RNK's browser, the only access environment

**VEIL** is a Tauri desktop browser with embedded P.R.O.T.E.C.T.S. policy (fail-closed),
C.O.M.M.A.N.D.-gated sessions, and a small, real engine/turbo runtime. **VEIL is the only
client**: Raven, Echonet, Mail, and RNK product surfaces run inside VEIL, and their
authenticated APIs refuse a normal browser. Public marketing on `rnk-enterprise.us` may
stay world-readable; login/API surfaces may not.

Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
RNK Enterprise — Proprietary and Confidential. Do not distribute.

Stack fit and doctrine: `VEIL.md`.

## Quick start

```bash
npm install
npm run dev:vite      # frontend on :1420
npm run dev:tauri     # Tauri shell (second terminal)
```

Ubuntu 24.04+ ships WebKitGTK 4.1 under 4.1 sonames; Tauri 1 links the 4.0 names. The
repo carries the fix: `scripts/with-webkit-pc.sh` + `src-tauri/.cargo/config.toml`.
`npm run check:rust` and `cargo test` work on this host.

## Access doctrine

- **Production auth = C.O.M.M.A.N.D. session** via the Resolute Authentication Core
  (`COMMAND_URL` / `RESOLUTE_URL`). A production build without it prints a fail-closed
  HOLD and creates **no sessions**.
- **Exchange flow:** `POST {COMMAND_URL}/api/v1/owner/session/start` → `session/verify`
  with the C.O.M.M.A.N.D.-minted grant (four-layer Mother handshake evidence; VEIL never
  fabricates it) → verified session mirrored into the policy engine. Explicit `session/end`.
- **Heartbeat:** every 5 s; B1 owns the 15/10/5 warning tiers; 3 consecutive failed
  beats = link drop → session dropped → **VEIL re-locks** (fail closed). Only a fresh
  grant exchange re-arms.
- **Shortcodes are DEV/bootstrap only** (`veil-odinn` full/creator, `veil-agent` agent);
  refused in production builds.
- **Biosig stubs never succeed** — `__lisa_handshake__` / `__mother_lisa__` / `__biosig__`
  / `__fido__` are refused until Mother Lisa ships.

## VEIL-only attestation

After a session exists, VEIL attaches `X-VEIL-Client: 1`, `X-VEIL-Session`, and
`X-VEIL-Tier` (`full` / `agent` / `dev`) to RNK product hosts. Header names are
documented, not secret; tokens are per-session. Details: `docs/VEIL_ATTESTATION.md`.

## Architecture

- **Auth gate** → C.O.M.M.A.N.D./Resolute session; shortcodes dev-only; biosig stubbed.
- **P.R.O.T.E.C.T.S. policy** → Rust in-process + optional remote overlay; fail-closed;
  loopback/metadata destinations blocked; `sec.rnk-enterprise.us` fail-closed until
  Ghost chain routing is wired.
- **Engine runtime** → `src/engines` + `src/turbos` + `veil-manifest.json`.
- **Live turbos** → tab suspend, memory reclaim, prefetch, DNS cache, render throttle,
  image lazy, cache budget, startup defer, network idle.
- **Catalog** → 8 engines + 9 live turbos. **Zero stubs** — the 800-engine/4000-turbo
  stub catalog was retired 2026-09-06; `npm run catalog` emits only real entries.
- **Chrome sections** → Browser (default), P.R.O.T.E.C.T.S. health, Ops/People (Raven
  webviews), Comms (Echonet webview), Server Control (Resolute), Admin (local audit).

## Sweep 2026-09-17

`coverage/` and the stale `dist/` build removed (rebuilt with the standard build);
`.gitignore` hardened. Git remote migrated to private `RNK-Enterprise/veil` — the old
`lisasdungeon/axis` GitHub remote is retired from this tree (history preserved there;
nothing pushed to it in this sweep).

## Secret scanning

Gitleaks runs as a git hook (pre-commit scans staged content; pre-push scans full
history). Both fail closed. After cloning:

```bash
git config core.hooksPath .githooks
```

Bypass is `--no-verify` — audited use only.

Verified false positives are fingerprinted in `.gitleaksignore` with reasons — never
weaken `.gitleaks.toml`.
