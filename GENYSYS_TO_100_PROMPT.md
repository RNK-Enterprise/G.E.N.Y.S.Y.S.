# GENYSYS → 100% AGENT PROMPT
**Tree (SoT):** `/media/odinn/privacy-sys/G.E.N.Y.S.Y.S.`  
**Date:** 2026-09-06  
**Paste the fenced block into a fresh agent.**

GENYSYS is **the browser**. It is the only client. A.R.C.H., the communications platform, Mail, Website product surfaces, C.O.M.M.A.N.D. session chrome, P.R.O.T.E.C.T.S. — they do **not** work unless opened inside GENYSYS. Odinn overrules the 2026-05-21 note that agencies skip GENYSYS and use Chrome.

Engines/turbos: **rebuild small**. The 800/4000 stub catalog is useless. Keep only what a browser actually runs.

---

## 100% map (read this first)

| Slice | 100% looks like | Have now | Need |
|---|---|---|---|
| **Identity** | GENYSYS = only access environment. README/GENYSYS.md say that. No `/media/odinn/privacy-sys/G.E.N.Y.S.Y.S.`. | Tauri 0.1.0 `com.rnk.genysys`. README still `/media/odinn/privacy-sys/G.E.N.Y.S.Y.S.`. Evidence GENYSYS_ARCHITECTURE still says agencies skip GENYSYS | Rewrite GENYSYS.md + README. Evidence copy: add a dated supersede note if you touch it; do not silently keep Chrome-as-client. |
| **Catalog** | Only real browser engines + the 9 live turbos. Manifest matches `src/`. No pad-to-800. | `scripts/generate-genysys-catalog.mjs` **ENGINE_COUNT=800 TURBO_COUNT=4000**; 9 live in `src/turbos/` | Kill the generator’s mass stubs. Hand-written tiny manifest. `prebuild` must not regenerate 4000 fakes. |
| **Gate** | C.O.M.M.A.N.D. session (fingerprint → jump drive → face/voice → heartbeat). Shortcodes are not production. | `auth.rs` access codes; biosig stubs **never succeed** (good — don’t fake) | Wire to C.O.M.M.A.N.D. / Resolute. If the key app is dark → **fail closed**. Dev bypass stays DEV-only. |
| **Policy** | Every navigation through P.R.O.T.E.C.T.S. / Resolute overlay optional; local still fail-closed. RNK product hosts only load in GENYSYS-privileged tabs. | `protects_policy.rs` — unauthenticated block; after shortcode **any https allow**. Product-domain allowlist paints Privileged | Allowlist configured RNK surfaces. Rename Policy→P.R.O.T.E.C.T.S. in GENYSYS code you touch. `chain` decision must mean Ghost, not a no-op. |
| **Nothing outside GENYSYS** | A.R.C.H. / communications platform / Mail / demo product APIs reject non-GENYSYS clients | Those apps have their own JWT/logins; work in Chrome | GENYSYS issues an attestation (header or cookie) after session. **Minimal** checks in A.R.C.H./Mail/communications-platform/Website-demo **only** to refuse missing attestation. Do not rebuild those products. Public marketing `rnk-enterprise.us` may stay world-readable; **login/API** must not. |
| **Chrome** | Browser is real. Other sections are real webviews or honest empty | Ops/People/Comms/Admin = “Coming soon”. Policy = local chat stub. Server Control → `:7700` `/api/layer1` | Browser 100%. Policy section → P.R.O.T.E.C.T.S. health (Resolute), not a fake chatbot. Comms/Ops/People remain explicit product surfaces with no guessed destinations. Server Control → Resolute, not Brain/Policy `:7700` as the mind. |
| **Build** | `npm run build` / `cargo check` on a host with webkit | 2026-08-21: javascriptcoregtk missing here | Prove on a machine that can compile, or FULL STOP listing the missing SDK. Do not fake a green Tauri build. |

**Live turbos to KEEP (already in `src/turbos/`):**  
tab-suspend, memory-reclaim, nav-prefetch, dns-cache, render-throttle, image-lazy-shell, cache-budget, startup-defer, network-idle.

**Engines to KEEP (real browser jobs only):**  
genysys-browser-core, genysys-security-stack (policy), genysys-performance-stack (those turbos), genysys-privacy-stack, genysys-downloads, genysys-bookmarks, genysys-history, genysys-settings.  
Drop: 800 pads, cloud/sync/automation placeholders, an unnamed communications-platform placeholder (the communications surface is a **page in GENYSYS**, not a GENYSYS engine), fake extensions.

**Not 100% until:** stub catalog gone, C.O.M.M.A.N.D. or honest fail-closed, RNK apps refuse Chrome, sections are not “Coming soon” for configured A.R.C.H./communications surfaces.

---

```text
You are taking GENYSYS to 100% as RNK’s only browser / only access environment.

You have NO prior session memory. VERIFY on disk. Be completely honest.
Do not claim 100% unless the catalog is small and real, the gate is C.O.M.M.A.N.D. or fail-closed, and A.R.C.H./communications-platform/Mail login-APIs refuse a normal browser.
Do not lie. Do not shortcut. Do not pad engines.

═══════════════════════════════════════════════════════════════
LOCKED
═══════════════════════════════════════════════════════════════
- SoT: /media/odinn/privacy-sys/G.E.N.Y.S.Y.S.
  (ignore /media/odinn/privacy-sys/G.E.N.Y.S.Y.S. except to fix docs that still say it)
- GENYSYS is THE client. A.R.C.H., the communications platform, Mail, demo product surfaces, C.O.M.M.A.N.D. chrome, P.R.O.T.E.C.T.S. — not usable outside GENYSYS for creator/agents.
- Odinn overrules Evidence GENYSYS_ARCHITECTURE § agencies-use-Chrome. Do not restore that sentence as current doctrine.
- Policy (the mind) = P.R.O.T.E.C.T.S. Handshake organ = Resolute Authentication Core.
- C.O.M.M.A.N.D. = master key (obsolete creator identity still in play). GENYSYS does not replace it; GENYSYS opens after it.
- Fail-closed: policy error / key app dark / missing attestation → block. Never fail open. Dev bypass = Vite DEV + genysys_dev_bypass only.
- Catalog: ONLY browser-real engines + the 9 live turbos. Delete the 800/4000 stub mill.
- Do not edit Ghost Comms crypto, Vortex, Anvil locker, P.R.O.T.E.C.T.S. organ internals, D.O.M.A.I.N.
- You MAY add a small GENYSYS-attestation check in A.R.C.H. / Mail / communications-platform / Website-demo APIs. No CRM feature work. No Mail IMAP work. No Website marketing copy except if a login page must refuse Chrome.
- Public marketing GET rnk-enterprise.us can stay public. Authenticated APIs cannot.
- ≤500 LOC on files you touch; split if you must. main.js was ~7k — finish the extract, don’t grow it.
- No git commit unless Odinn says. No fleet deploy of brains.
- Do not print secrets, access codes in docs, or .env.
- FULL STOP if C.O.M.M.A.N.D. handshake URL is unknown — fail closed locally; do not invent Brain :8123 as Policy.

═══════════════════════════════════════════════════════════════
ORDER (STRICT)
═══════════════════════════════════════════════════════════════
0. Inventory
   Confirm Privacy GENYSYS (not /mnt/external). Count live turbos in src/turbos vs manifest. Confirm generate-genysys-catalog.mjs still emits 800/4000. List RNK URLs GENYSYS actually opens (today: almost none).

1. Kill useless catalog
   Stop prebuild from generating stubs.
   Replace genysys-manifest.json (src/ + public/) with a short hand-written catalog: kept engines + 9 live turbos only, status live/stable matching src/.
   Delete or gut generate-genysys-catalog.mjs so it cannot emit pads (or make it write the tiny catalog only).
   Runtime must not claim 800 engines.

2. Browser 100%
   Tabs, omnibox, bookmarks, history, downloads, settings, fail-closed navigate_tab, live turbos wired.
   Finish main.js cutover to extracted modules if still a blob.
   Tests: policy unauthenticated → block; authenticated internal genysys:// → allow; missing Tauri in production → no silent allow (dev fallback stays DEV-only).

3. Gate
   Production auth = C.O.M.M.A.N.D. / Resolute session, not genysys-odinn codes as the product.
   Shortcodes: DEV/bootstrap only, labeled, off in production builds.
   Biosig stubs must still never return success.

4. GENYSYS-only access
   After session, GENYSYS attaches an attestation on requests to RNK product hosts (header name documented, not a secret in git).
   Privileged tab list: configured RNK product hosts, mail.rnk-enterprise.us, demo.rnk-enterprise.us (product, not pentest), C.O.M.M.A.N.D. surfaces as needed.
   sec.rnk-enterprise.us stays out of the default agent chrome (private pentest).
   Minimal refuse-if-no-attestation on A.R.C.H./Mail/communications-platform login+API. If you cannot touch those trees, FULL STOP and list the exact files — do not pretend GENYSYS policy on Chrome is enough.

5. Chrome sections
   Browser = default.
   Policy section → P.R.O.T.E.C.T.S. organ health (Resolute), not genysys-policy-assistant stub chat as production.
   Comms → unnamed communications-platform surface inside GENYSYS.
   Ops/People → A.R.C.H. surfaces inside GENYSYS (Operations + users database). Unconfigured destinations are explicit fail-closed state.
   Server Control → Resolute/P.R.O.T.E.C.T.S., not localhost:7700 Policy layer1 as the mind.

6. Docs
   GENYSYS.md + README: only client; catalog size truth; C.O.M.M.A.N.D. gate; Privacy path.
   Do not rewrite every product Rules file. GENYSYS Rules Q06 may get a short nits pass: GENYSYS is the only client.

7. STOP. Report:
   - engine/turbo counts before vs after
   - files deleted/gutted in the catalog mill
   - auth: C.O.M.M.A.N.D. wired or fail-closed HOLD
   - which RNK APIs now refuse non-GENYSYS
   - cargo/webkit HOLD if this host cannot build
   - remaining Coming-soon sections

═══════════════════════════════════════════════════════════════
VERIFY BAR
═══════════════════════════════════════════════════════════════
[1] All GENYSYS work under /media/odinn/privacy-sys/G.E.N.Y.S.Y.S. except the tiny attestation hooks in A.R.C.H./Mail/communications-platform/Website-demo
[2] Manifest engines+turbos ≤ ~20 real entries; no 800/4000
[3] src/turbos still has the 9 live implementations; they are what the manifest calls live
[4] Unauthenticated navigate → block
[5] Production build has no genysys_dev_bypass path
[6] Biosig stub strings still cannot authenticate
[7] README does not say /media/odinn/privacy-sys/G.E.N.Y.S.Y.S. as SoT
[8] Ghost crypto / P.R.O.T.E.C.T.S. organ src / Vortex untouched
[9] Honest last line: remaining HOLDs (C.O.M.M.A.N.D. URL, webkit SDK, products not yet refusing Chrome)
```
