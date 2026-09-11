# Axis — agent file

RNK Enterprise — Proprietary and Confidential.
SoT: `/media/odinn/privacy-system/Axis`
Portable memory (any agent, whole system): `/media/odinn/privacy-system/memory/SYSTEM.md`
Swept 2026-09-10. Ask Odinn before acting.

You are in the **Axis** tree. Axis is RNK's **only client / only access environment**. It is a Tauri desktop browser. It is not C.O.M.M.A.N.D., not P.R.O.T.E.C.T.S., not the products.

---

## Job

Be the door. Session from C.O.M.M.A.N.D. (Resolute). Every navigation cleared by in-process P.R.O.T.E.C.T.S. policy (fail-closed). Raven, Echonet, Mail, and other RNK product surfaces open **inside Axis**. Their login/API surfaces refuse a normal browser.

Public marketing on `rnk-enterprise.us` may stay world-readable. Login/API may not.

Old path `/mnt/external/Axis` is retired. Do not write it.

## Pipeline

```
C.O.M.M.A.N.D. / Resolute  (master key, session grant)
  -> Axis shell            (Tauri + Vite chrome, tabs, omnibox)
       P.R.O.T.E.C.T.S. policy in Rust clears every nav
       Attestation headers on RNK product hosts
  -> Raven / Echonet / Mail / Command chrome  (webviews inside Axis)
```

Axis opens **after** the key app. Axis does not replace it.

## Do not

- Fail open if policy errors or is unreachable. Block.
- Invent a fallback identity provider if C.O.M.M.A.N.D. is dark. Hold.
- Ship shortcodes or `axis_dev_bypass` in production. Shortcodes are DEV/bootstrap only.
- Make biosig stubs succeed (`__lisa_handshake__`, `__mother_lisa__`, `__biosig__`, `__fido__`). They refuse until Mother Lisa ships.
- Treat `sec.rnk-enterprise.us` as a default tab. Policy fail-closes it (`chain_unavailable_fail_closed`) until Ghost chain routing is wired. A `chain` decision is not "load it directly."
- Revive the 800-engine / 4000-turbo stub catalog. Catalog is real-only: 8 engines + 9 live turbos.
- Pad `scripts/generate-axis-catalog.mjs`. Edit the real list, do not invent inventory.
- Touch Ghost crypto, Vortex, P.R.O.T.E.C.T.S. organ internals, or D.O.M.A.I.N. from this tree.
- Point the health panel at leftover hop names. Handshake organ is Resolute.

## Gate (production)

- Env: `COMMAND_URL` or `RESOLUTE_URL`. Empty on a release build → loud HOLD, **no sessions**.
- Exchange: `POST {COMMAND_URL}/api/v1/owner/session/start` then `session/verify` with the C.O.M.M.A.N.D.-minted grant. Axis never fabricates the grant. Booleans carry zero authority on B1.
- Heartbeat: `POST {COMMAND_URL}/gateway/v1/heartbeat` every 5 s. 3 missed beats → session dropped → Axis re-locks. Only a fresh grant re-arms.
- Bench exception: `AXIS_TEST_MODE=1` (explicitly not production).
- Native: `src-tauri/src/command_gate.rs`, `command_session.rs`, `auth.rs`.

## Policy

In-process Rust (`src-tauri/src/lisa_policy.rs`). Optional remote overlay via `LISA_URL` (never a boot requirement).

Always blocked: `localhost`, `127.0.0.1`, `169.254.169.254`, other metadata/loopback. Plain `http://` off-loopback blocked. Internal chrome uses `axis://`.

## Catalog

8 engines + 9 live turbos. Zero stubs. Manifest: `public/axis-manifest.json` + `src/axis-manifest.json`. Generator: `scripts/generate-axis-catalog.mjs` (real-only). Live turbos under `src/turbos/`: tab-suspend, memory-reclaim, nav-prefetch, dns-cache, render-throttle, image-lazy-shell, cache-budget, startup-defer, network-idle.

## Attestation

After a session exists, Axis attaches:

| Header | Value |
|---|---|
| `X-Axis-Client` | `1` |
| `X-Axis-Session` | session token |
| `X-Axis-Tier` | `full` / `agent` / `dev` |

Iframe cookie bootstrap: native `attestation_bootstrap` → `axis_attest`. Contract: `docs/AXIS_ATTESTATION.md`, middleware `docs/axis-attestation-gate.cjs`.

| Product | Mode as of 2026-09-06 |
|---|---|
| Raven `/api/axis/*` | **enforced** |
| Echonet session/control | **enforced** |
| Mail `/api` | **log-only** until `AXIS_ATTEST_ENFORCE=1` |
| Website demo `/api` | **log-only** until `AXIS_ATTEST_ENFORCE=1` |

## Chrome

Browser (default). P.R.O.T.E.C.T.S. health (Resolute). Ops/People = Raven webviews. Comms = Echonet webview. Server Control = Resolute. Admin = local audit. Sidebar was removed 2026-09-06; Spotlight (Ctrl+K) is the launcher.

Webview hosts in `src/shell/rnk-webviews.js`: `raven.rnk-enterprise.us`, `echonet.rnk-enterprise.us`.

Health default Resolute URL in the panel is still `http://127.0.0.1:7781` (localStorage `axis_resolute_url`). That is **not** live C.O.M.M.A.N.D. Do not treat it as the fleet.

## Commands

```bash
cd /media/odinn/privacy-system/Axis
npm run dev:vite          # :1420
npm run dev:tauri         # native shell (webkit 4.0→4.1 shim)
npm run check:rust
npm run catalog
# cargo test in src-tauri: policy, attestation, Resolute exchange
```

Ubuntu 24.04: WebKitGTK 4.1 under 4.1 sonames; Tauri 1 wants 4.0. Shim is `scripts/with-webkit-pc.sh` + `src-tauri/.cargo/config.toml`. Do not "fix" by installing 4.0 packages.

`main.js` is a thin orchestrator (under the 500 LOC cap). Do not grow it back into a monolith.

## Honest remaining

- Gate is **coded**, not live-wired. Production Axis HOLDs without `COMMAND_URL`. C.O.M.M.A.N.D. daemon on this host has been dark. Do not claim Axis is talking to the fleet until that URL is set and the coordinator answers.
- Mail and Website demo attestation are log-only.
- Ghost chain for `sec.rnk` is not wired.
- Git tree has no commits (all untracked as of sweep).
- `package.json` description still says "Mother Lisa". Stale.
- No JS unit tests despite Jest in `package.json`. Rust tests exist.
- Bundles exist at 0.1.0 (`AppImage` / `.deb` / `.rpm`). Not proven against live C.O.M.M.A.N.D.

## Out of scope

CRM feature work. Mail IMAP. Marketing copy. Ghost crypto. Vortex. Organ internals. D.O.M.A.I.N. Reviving the stub catalog. Agencies skipping Axis for Chrome (Odinn overrules that 2026-05-21 note).
