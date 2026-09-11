# Axis

**RNK's browser — the only access environment.**
Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.

Axis is a Tauri desktop browser with embedded P.R.O.T.E.C.T.S. policy (fail-closed), C.O.M.M.A.N.D.-gated sessions, and a small, real engine/turbo runtime. **Axis is the only client**: Raven, Echonet, Mail, and RNK product surfaces are meant to run inside Axis, and their authenticated APIs refuse a normal browser. Public marketing on `rnk-enterprise.us` may stay world-readable; login/API surfaces may not.

See [AXIS.md](./AXIS.md) for stack fit and doctrine.

## Quick start

```bash
cd /media/odinn/privacy-system/Axis   # Source of Truth
npm install

# Terminal A — Vite
npm run dev:vite

# Terminal B — Tauri shell
npm run dev:tauri
```

Ubuntu 24.04+ ships WebKitGTK 4.1 under 4.1 sonames; Tauri 1 links the 4.0 names. The repo carries the fix: `scripts/with-webkit-pc.sh` maps the pkg-config names, and `src-tauri/.cargo/config.toml` adds `.pkgconfig/lib` (4.0→4.1 symlinks) to the linker path. `npm run check:rust` and `cargo test` work on this host.

## Access doctrine

- **Production auth = C.O.M.M.A.N.D. session** via the Resolute Authentication Core. Configure `COMMAND_URL` (or `RESOLUTE_URL`). A production build without it prints a fail-closed HOLD and creates **no sessions**.
- **Exchange flow (wire path `PROTECTS_WIRE_PATH_2026-09-04.md`):** Axis `POST {COMMAND_URL}/api/v1/owner/session/start` → `session/verify` with the C.O.M.M.A.N.D.-minted grant (four-layer Mother handshake evidence; Axis never fabricates it — booleans carry zero authority on B1) → verified session mirrored into the policy engine. Explicit end via `session/end`.
- **Heartbeat:** Axis beats `POST {COMMAND_URL}/gateway/v1/heartbeat` every 5 s. B1 owns the 15/10/5 warning tiers; Axis mirrors drop detection client-side — 3 consecutive failed beats = link drop → session dropped → **Axis re-locks** (fail closed). Only a fresh grant exchange re-arms.
- **Shortcodes are DEV/bootstrap only.** `auth_resolve_code` refuses shortcodes in production builds (`cargo` release / not `AXIS_TEST_MODE=1`). Dev bypass (`localStorage axis_dev_bypass`) requires Vite `import.meta.env.DEV` and never exists in production bundles.
- **Biosig stubs never succeed.** `__lisa_handshake__` / `__mother_lisa__` / `__biosig__` / `__fido__` are refused until Mother Lisa ships.

### Shortcodes (dev/bootstrap)

| Code | Tier |
|------|------|
| `axis-odinn` | full (creator) |
| `axis-agent` | agent |

Format: `code:tier:agentId,code2:tier:agentId` via `AXIS_ACCESS_CODES`.

## Axis-only access (attestation)

After a session exists, Axis attaches these headers to RNK product hosts:

| Header | Meaning |
|---|---|
| `X-Axis-Client` | `1` — request came from Axis |
| `X-Axis-Session` | Axis session token |
| `X-Axis-Tier` | `full` / `agent` / `dev` |

Header names are documented here (not secret); tokens are per-session. Raven / Echonet / Mail login+API endpoints perform a minimal refuse-if-missing check — see `docs/AXIS_ATTESTATION.md` and the hooks in those repos.

## Architecture

- **Auth gate** → C.O.M.M.A.N.D./Resolute session; shortcodes dev-only; biosig stubbed
- **P.R.O.T.E.C.T.S. policy** → Rust in-process + optional remote overlay; fail-closed; loopback/metadata destinations blocked; `sec.rnk-enterprise.us` fail-closed until Ghost chain routing is wired
- **Engine runtime** → `src/engines` + `src/turbos` + `axis-manifest.json`
- **Live turbos** → tab suspend, memory reclaim, prefetch, DNS cache, render throttle, image lazy, cache budget, startup defer, network idle
- **Catalog** → 8 engines + 9 live turbos. **Zero stubs.** The 800-engine / 4000-turbo stub catalog was retired 2026-09-06; `npm run catalog` now emits only the real entries.
- **Chrome sections** → Browser (default), P.R.O.T.E.C.T.S. health (Resolute-backed), Ops/People (Raven webviews in Axis), Comms (Echonet webview in Axis), Server Control (Resolute), Admin (local audit)

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev:vite` | Frontend on :1420 |
| `npm run dev:tauri` | Native shell |
| `npm run build` | Production Tauri build |
| `npm run catalog` | Emit the tiny real-only manifest |
| `npm run check:rust` | `cargo check` with the webkit shim |
| `npm run verify` | Every gate in one run: global audit → Jest → Playwright → `cargo test` (40 Rust tests) |
| `npm run verify -- <stage>` | Run one stage only (`audit`, `unit`, `e2e`, `rust`); `--fail-fast` stops at the first failure |
| `npm test` | Jest unit suite (`tests/`, `src/**/*.test.js`) |
| `npm run test:e2e` | Playwright E2E — boots the shell, fails on any console error |
| `npm run audit:globals` | Global-wiring gate — an unwired `window.*` read fails the build |

## Doctrine

If P.R.O.T.E.C.T.S. policy is unreachable or errors → **block**. Never fail open. Key app dark → **hold**. Missing attestation → RNK product APIs **refuse** the request.
