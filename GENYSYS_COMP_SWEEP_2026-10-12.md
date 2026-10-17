# G.E.N.Y.S.Y.S. (Genysys) — Architecture + Gap Analysis (competence sweep)

**Owner-review draft** — Odinn sign-off required.  
**Date:** 2026-10-12  
**Tree:** `/media/odinn/privacy-sys/G.E.N.Y.S.Y.S.`  
**Human name:** Genysys (the beginning / only RNK access environment)  
**Not this:** Obfuscation Veil Array (P.R.O.T.E.C.T.S. Seat-2 organ)  
**Method:** Live architecture map + rename pass + Jest + cargo test.  
**Git:** local commit only (no push) per owner.

### Live verification (this seat, 2026-10-12)

| Gate | Result |
|---|---|
| `npm test` (Jest) | **320/320 pass** (after rename) |
| `cargo test` (src-tauri via webkit shim) | **40/40 pass** |
| LOC audit | previously OK (≤500 hand-written); re-run optional |
| Catalog | **8 engines + 9 live turbos, 0 stubs** (`npm run catalog`) |
| C.O.M.M.A.N.D. live wire | **Not proven** — production HOLDs without `COMMAND_URL` / `RESOLUTE_URL` (by design) |

---

## 1. What Genysys is

**G.E.N.Y.S.Y.S. / Genysys** is RNK’s **only client / only access environment** — a Tauri desktop browser.

| Neighbor | Role |
|---|---|
| C.O.M.M.A.N.D. / Resolute | Session grant + heartbeat; Genysys never fabricates grants |
| P.R.O.T.E.C.T.S. | In-process Rust nav policy (`protects_policy.rs`); fail-closed |
| Raven / Echonet / Mail | Product webviews **inside** Genysys; APIs refuse normal browsers via attestation |
| Obfuscation Veil Array | **Different program** — Seat-2 gauntlet/honeypot organ inside P.R.O.T.E.C.T.S. |

**Pipeline:** C.O.M.M.A.N.D. grant → Genysys shell → policy clears every nav → attestation on RNK hosts → product webviews.

**Naming history:** Atlas Browser → Axis → V.E.I.L. → **G.E.N.Y.S.Y.S.** (2026-10-12 Odinn ruling).

### Wire identity (post-rename)

| Item | Value |
|---|---|
| Package / crate | `rnk-genysys` |
| Bundle id | `com.rnk.genysys` |
| Product name | `GENYSYS` |
| Scheme | `genysys://` |
| Headers | `X-GENYSYS-Client` / `X-GENYSYS-Session` / `X-GENYSYS-Tier` |
| Cookie | `genysys_attest` |
| Dev bypass | `genysys_dev_bypass` (DEV only) |
| Shortcodes | `genysys-odinn` / `genysys-agent` (DEV/bootstrap only) |
| Test env | `GENYSYS_TEST_MODE=1` |

---

## 2. Architecture (solid)

- Tauri 1 + Vite chrome; `main.js` thin orchestrator (~153 LOC)
- Tabs / omnibox / bookmarks / history / downloads / settings
- 8 real engines + 9 live turbos (stub mill killed)
- Fail-closed policy: loopback/metadata blocked; plain http off-loopback blocked; unauthenticated RNK surfaces blocked
- COMMAND gate coded: empty URL on release → HOLD, no sessions; heartbeat 3-strike drop
- Attestation bootstrap for product hosts
- WebKitGTK 4.1 shim for Ubuntu 24.04

---

## 3. Gap analysis

### P0

| Gap | Impact |
|---|---|
| **Product API consumers still on old `/api/veil` + `X-VEIL-*`** | Raven (Archive-OOS path seen); Mail/Website demo gates. Until those trees accept `X-GENYSYS-*` / `/api/genysys` (or dual-accept), live “only client” enforcement breaks the wrong way. |
| **No Odinn sign-off / no push** | Rename is local; remotes and agency installs still say V.E.I.L. until published. |
| **C.O.M.M.A.N.D. not live-wired on this seat** | Gate is honest HOLD; Genysys is not fleet-proven as the access door yet. |

### P1

| Gap | Impact |
|---|---|
| Mail + Website demo attestation still **log-only** until `GENYSYS_ATTEST_ENFORCE=1` | Chrome can still hit those APIs until enforce flips. |
| Ghost chain for `sec.rnk-enterprise.us` unwired | Policy fail-closes (`chain_unavailable_fail_closed`) — correct, incomplete. |
| Biosig stubs refuse until the authority session ships | Correct fail-closed; production path is a verified authority grant, not shortcodes. |
| SoT docs that still name `privacy-system/V.E.I.L.` elsewhere in the mesh | Twin/path drift for agents. |

### P2

| Gap | Impact |
|---|---|
| `protects_policy.rs` / `policy-bridge` filenames still say Policy | Functional; naming hygiene residual (mind = P.R.O.T.E.C.T.S.). |
| Rules copies outside this tree may still say Axis/V.E.I.L. | Fleet-wide doc sync pending. |
| Halo/Echonet “do not call it Genysys” lines | Correct after rename; Halo must never absorb the browser name. |
| Bundles 0.1.0 exist historically; not re-proven against live COMMAND this sweep | Packaging OK; live gate unproven. |

### Explicit non-gaps

- Obfuscation Veil Array Seat-2 (separate organ; keep `X-Veil-*` honeypot signals).
- CRM feature work, Mail IMAP, Ghost crypto, organ internals.

---

## 4. Competence summary

| Axis | Assessment |
|---|---|
| **Identity / naming** | Locked Genysys this pass inside the tree |
| **Browser core** | Strong — real chrome + turbos + LOC discipline |
| **Fail-closed auth/policy** | Strong in code; live COMMAND unproven |
| **Only-client attestation** | Coded in Genysys; **product consumers lag** after header rename |
| **Ship readiness** | Local rename green; not fleet-shipped |

**Bottom line:** Genysys is the browser (beginning). Seat-2 Veil is the honeypot organ. This tree’s rename + tests are green locally. Next risk is coordinating Raven/Mail/Echonet attestation to `X-GENYSYS-*` before claiming live only-client enforcement.

---

## 5. Suggested next work (implement only if Odinn orders)

1. Dual-accept window on product gates (`X-VEIL-*` **or** `X-GENYSYS-*`) then cut over.
2. Point mesh SoT / agent files at `/media/odinn/privacy-sys/G.E.N.Y.S.Y.S.`.
3. Live COMMAND_URL prove-out on a bench host.
4. Flip Mail/Website `GENYSYS_ATTEST_ENFORCE=1` when ready.
5. Optional: rename `protects_policy.rs` → `protects_policy.rs` in a dedicated pass.
6. Odinn sign-off + push when ready.

---

## 6. Commands

```bash
cd /media/odinn/privacy-sys/G.E.N.Y.S.Y.S.
npm test
bash scripts/with-webkit-pc.sh cargo test --manifest-path src-tauri/Cargo.toml
npm run catalog
npm run check:rust
```
