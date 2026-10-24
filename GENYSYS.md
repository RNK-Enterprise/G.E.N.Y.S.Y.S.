# G.E.N.E.S.Y.S. — agent file

RNK Enterprise — Proprietary and Confidential.
SoT: `/media/odinn/privacy-sys/G.E.N.Y.S.Y.S.`
Portable memory (any agent, whole system): `/media/odinn/privacy-system/memory/SYSTEM.md`
Swept 2026-09-20. Ask Odinn before acting.

You are in the **G.E.N.E.S.Y.S.** tree. G.E.N.E.S.Y.S. is RNK's **only client / only access environment**. It is a Tauri desktop browser. It is not C.O.M.M.A.N.D., not P.R.O.T.E.C.T.S., not the products.

---

## Job

Be the door. Session from C.O.M.M.A.N.D. (Resolute). Every navigation cleared by in-process P.R.O.T.E.C.T.S. policy (fail-closed). A.R.C.H., Mail, the communications platform, and other RNK product surfaces open **inside G.E.N.E.S.Y.S.**. Their login/API surfaces refuse a normal browser.

Public marketing on `rnk-enterprise.us` may stay world-readable. Login/API may not.

Old path `/media/odinn/privacy-sys/G.E.N.Y.S.Y.S.` is retired. Do not write it.

## Pipeline

```
C.O.M.M.A.N.D. / Resolute  (master key, session grant)
  -> G.E.N.E.S.Y.S. shell     (Tauri + Vite chrome, tabs, omnibox)
       P.R.O.T.E.C.T.S. policy in Rust clears every nav
       Attestation headers on RNK product hosts
  -> A.R.C.H. / communications platform / Mail / Command chrome  (webviews inside GENYSYS)
```

G.E.N.E.S.Y.S. opens **after** the key app. G.E.N.E.S.Y.S. does not replace it.

## Do not

- Fail open if policy errors or is unreachable. Block.
- Invent a fallback identity provider if C.O.M.M.A.N.D. is dark. Hold.
- Ship shortcodes or `genysys_dev_bypass` in production. Shortcodes are DEV/bootstrap only.
- Make biosig or FIDO challenge strings succeed. They remain invalid until a verified
  C.O.M.M.A.N.D. session or configured development/bootstrap code exists.
- Treat `sec.rnk-enterprise.us` as a default tab. Policy fail-closes it (`chain_unavailable_fail_closed`) until Ghost chain routing is wired. A `chain` decision is not "load it directly."
- Revive the 800-engine / 4000-turbo stub catalog. Catalog is real-only: 8 engines + 9 live turbos.
- Pad `scripts/generate-genysys-catalog.mjs`. Edit the real list, do not invent inventory.
- Touch Ghost crypto, Vortex, P.R.O.T.E.C.T.S. organ internals, or D.O.M.A.I.N. from this tree.
- Point the health panel at leftover hop names. Handshake organ is Resolute.

## Gate (production)

- Env: `COMMAND_URL` or `RESOLUTE_URL`. Empty on a release build → loud HOLD, **no sessions**.
- Exchange: `POST {COMMAND_URL}/api/v1/owner/session/start` then `session/verify` with the C.O.M.M.A.N.D.-minted grant. GENYSYS never fabricates the grant. Booleans carry zero authority on B1.
- Heartbeat: `POST {COMMAND_URL}/gateway/v1/heartbeat` every 5 s. 3 missed beats → session dropped → GENYSYS re-locks. Only a fresh grant re-arms.
- Bench exception: `GENYSYS_TEST_MODE=1` (explicitly not production).
- Native: `src-tauri/src/command_gate.rs`, `command_session.rs`, `auth.rs`.

## Policy

In-process Rust (`src-tauri/src/protects_policy.rs`). Optional remote overlay via `PROTECTS_URL` (never a boot requirement).

Always blocked: `localhost`, `127.0.0.1`, `169.254.169.254`, other metadata/loopback. Plain `http://` off-loopback blocked. Internal chrome uses `genysys://`.

## Catalog

8 engines + 9 live turbos. Zero stubs. Manifest: `public/genysys-manifest.json` + `src/genysys-manifest.json`. Generator: `scripts/generate-genysys-catalog.mjs` (real-only). Live turbos under `src/turbos/`: tab-suspend, memory-reclaim, nav-prefetch, dns-cache, render-throttle, image-lazy-shell, cache-budget, startup-defer, network-idle.

## Attestation

After a session exists, GENYSYS attaches:

| Header | Value |
|---|---|
| `X-GENYSYS-Client` | `1` |
| `X-GENYSYS-Session` | session token |
| `X-GENYSYS-Tier` | `full` / `agent` / `dev` |

Iframe cookie bootstrap: native `attestation_bootstrap` → `genysys_attest`. Contract: `docs/GENYSYS_ATTESTATION.md`, middleware `docs/genysys-attestation-gate.cjs`.

| Product | Mode as of 2026-09-06 |
|---|---|
| A.R.C.H. product APIs | **destination contract pending** |
| Communications platform session/control | **destination contract pending** |
| Mail `/api` | **log-only** until `GENYSYS_ATTEST_ENFORCE=1` |
| Website demo `/api` | **log-only** until `GENYSYS_ATTEST_ENFORCE=1` |

## Chrome

Browser (default). P.R.O.T.E.C.T.S. health (Resolute). Ops/People = A.R.C.H. surfaces. Comms = unnamed communications platform surface. Server Control = Resolute. Admin = local audit. Sidebar was removed 2026-09-06; Spotlight (Ctrl+K) is the launcher.

Product destinations in `src/shell/rnk-webviews.js` remain intentionally unconfigured until their owning contracts provide authoritative routes.

Health default Resolute URL in the panel is still `http://127.0.0.1:7781` (localStorage `genysys_resolute_url`). That is **not** live C.O.M.M.A.N.D. Do not treat it as the fleet.

## Commands

```bash
cd /media/odinn/privacy-sys/G.E.N.Y.S.Y.S.
npm run dev:vite          # 127.0.0.1:1420
npm run dev:tauri         # native shell (webkit 4.0→4.1 shim)
npm test                  # Jest unit (src/)
npm run check:rust
npm run catalog
# cargo test in src-tauri: policy, attestation, COMMAND/Resolute exchange
```

Ubuntu 24.04: WebKitGTK 4.1 under 4.1 sonames; Tauri 1 wants 4.0. Shim is `scripts/with-webkit-pc.sh` + `src-tauri/.cargo/config.toml`. Do not "fix" by installing 4.0 packages.

`main.js` is a thin orchestrator (under the 500 LOC cap). Do not grow it back into a monolith.

## Honest remaining

- Gate is **coded**, not live-wired. Production GENYSYS HOLDs without `COMMAND_URL`. Do not invent a fallback IdP. Do not claim GENYSYS is talking to the fleet until that URL is set and the coordinator answers.
- Mail and Website demo attestation are log-only.
- Ghost chain for `sec.rnk` is not wired.
- Bundles exist at 0.1.0 (`AppImage` / `.deb` / `.rpm`). Not proven against live C.O.M.M.A.N.D.

## Sweep 2026-09-20

Vite + Tauri `devPath` pin `127.0.0.1`. `.gitignore` covers `.env` / secrets. `package.json` / Cargo description no longer say obsolete creator identity. `dist/.gitkeep` so cargo test compiles; `with-webkit-pc.sh` exports absolute `-L` so linking works from repo root. History tests use local calendar day (UTC ISO was crossing midnight in EDT). Jest + Rust tests are the test SoT. No IdP invented. Do not push from this sweep unless Odinn says so.

## Out of scope

CRM feature work. Mail IMAP. Marketing copy. Ghost crypto. Vortex. Organ internals. D.O.M.A.I.N. Reviving the stub catalog. Agencies skipping GENYSYS for Chrome (Odinn overrules that 2026-05-21 note).
