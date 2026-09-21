# VEIL → 100% AGENT PROMPT
**Tree (SoT):** `/media/odinn/privacy-system/VEIL`  
**Date:** 2026-09-06  
**Paste the fenced block into a fresh agent.**

VEIL is **the browser**. It is the only client. Raven, Echonet, Mail, Website product surfaces, C.O.M.M.A.N.D. session chrome, P.R.O.T.E.C.T.S. — they do **not** work unless opened inside VEIL. Odinn overrules the 2026-05-21 note that agencies skip VEIL and use Chrome.

Engines/turbos: **rebuild small**. The 800/4000 stub catalog is useless. Keep only what a browser actually runs.

---

## 100% map (read this first)

| Slice | 100% looks like | Have now | Need |
|---|---|---|---|
| **Identity** | VEIL = only access environment. README/VEIL.md say that. No `/mnt/external/VEIL`. | Tauri 0.1.0 `com.rnk.veil`. README still `/mnt/external/VEIL`. Evidence VEIL_ARCHITECTURE still says agencies skip VEIL | Rewrite VEIL.md + README. Evidence copy: add a dated supersede note if you touch it; do not silently keep Chrome-as-client. |
| **Catalog** | Only real browser engines + the 9 live turbos. Manifest matches `src/`. No pad-to-800. | `scripts/generate-veil-catalog.mjs` **ENGINE_COUNT=800 TURBO_COUNT=4000**; 9 live in `src/turbos/` | Kill the generator’s mass stubs. Hand-written tiny manifest. `prebuild` must not regenerate 4000 fakes. |
| **Gate** | C.O.M.M.A.N.D. session (fingerprint → jump drive → face/voice → heartbeat). Shortcodes are not production. | `auth.rs` access codes; biosig stubs **never succeed** (good — don’t fake) | Wire to C.O.M.M.A.N.D. / Resolute. If the key app is dark → **fail closed**. Dev bypass stays DEV-only. |
| **Policy** | Every navigation through P.R.O.T.E.C.T.S. / Resolute overlay optional; local still fail-closed. RNK product hosts only load in VEIL-privileged tabs. | `lisa_policy.rs` — unauthenticated block; after shortcode **any https allow**. `ECHONET_DOMAINS` only paints Privileged | Allowlist RNK surfaces. Rename Lisa→P.R.O.T.E.C.T.S. in VEIL code you touch. `chain` decision must mean Ghost, not a no-op. |
| **Nothing outside VEIL** | Raven / Echonet / Mail / demo product APIs reject non-VEIL clients | Those apps have their own JWT/logins; work in Chrome | VEIL issues an attestation (header or cookie) after session. **Minimal** checks in Raven/Mail/Echonet/Website-demo **only** to refuse missing attestation. Do not rebuild those products. Public marketing `rnk-enterprise.us` may stay world-readable; **login/API** must not. |
| **Chrome** | Browser is real. Other sections are real webviews or honest empty | Ops/People/Comms/Admin = “Coming soon”. Lisa = local chat stub. Server Control → `:7700` `/api/layer1` | Browser 100%. Lisa section → P.R.O.T.E.C.T.S. health (Resolute), not a fake chatbot. Comms/Ops/People = webviews to Echonet/Raven (in VEIL), not placeholders. Server Control → Resolute, not Brain/Lisa `:7700` as the mind. |
| **Build** | `npm run build` / `cargo check` on a host with webkit | 2026-08-21: javascriptcoregtk missing here | Prove on a machine that can compile, or FULL STOP listing the missing SDK. Do not fake a green Tauri build. |

**Live turbos to KEEP (already in `src/turbos/`):**  
tab-suspend, memory-reclaim, nav-prefetch, dns-cache, render-throttle, image-lazy-shell, cache-budget, startup-defer, network-idle.

**Engines to KEEP (real browser jobs only):**  
veil-browser-core, veil-security-stack (policy), veil-performance-stack (those turbos), veil-privacy-stack, veil-downloads, veil-bookmarks, veil-history, veil-settings.  
Drop: 800 pads, cloud/sync/automation placeholders, communication-hub-until-Echonet (Echonet is a **page in VEIL**, not an VEIL engine), fake extensions.

**Not 100% until:** stub catalog gone, C.O.M.M.A.N.D. or honest fail-closed, RNK apps refuse Chrome, sections are not “Coming soon” for Raven/Echonet.

---

```text
You are taking VEIL to 100% as RNK’s only browser / only access environment.

You have NO prior session memory. VERIFY on disk. Be completely honest.
Do not claim 100% unless the catalog is small and real, the gate is C.O.M.M.A.N.D. or fail-closed, and Raven/Echonet/Mail login-APIs refuse a normal browser.
Do not lie. Do not shortcut. Do not pad engines.

═══════════════════════════════════════════════════════════════
LOCKED
═══════════════════════════════════════════════════════════════
- SoT: /media/odinn/privacy-system/VEIL
  (ignore /mnt/external/VEIL except to fix docs that still say it)
- VEIL is THE client. Raven, Echonet, Mail, demo product surfaces, C.O.M.M.A.N.D. chrome, P.R.O.T.E.C.T.S. — not usable outside VEIL for creator/agents.
- Odinn overrules Evidence VEIL_ARCHITECTURE § agencies-use-Chrome. Do not restore that sentence as current doctrine.
- Lisa (the mind) = P.R.O.T.E.C.T.S. Handshake organ = Resolute Authentication Core.
- C.O.M.M.A.N.D. = master key (Mother Lisa still in play). VEIL does not replace it; VEIL opens after it.
- Fail-closed: policy error / key app dark / missing attestation → block. Never fail open. Dev bypass = Vite DEV + veil_dev_bypass only.
- Catalog: ONLY browser-real engines + the 9 live turbos. Delete the 800/4000 stub mill.
- Do not edit Ghost Comms crypto, Vortex, Anvil locker, P.R.O.T.E.C.T.S. organ internals, D.O.M.A.I.N.
- You MAY add a small VEIL-attestation check in Raven / Mail / Echonet / Website-demo APIs. No CRM feature work. No Mail IMAP work. No Website marketing copy except if a login page must refuse Chrome.
- Public marketing GET rnk-enterprise.us can stay public. Authenticated APIs cannot.
- ≤500 LOC on files you touch; split if you must. main.js was ~7k — finish the extract, don’t grow it.
- No git commit unless Odinn says. No fleet deploy of brains.
- Do not print secrets, access codes in docs, or .env.
- FULL STOP if C.O.M.M.A.N.D. handshake URL is unknown — fail closed locally; do not invent Brain :8123 as Lisa.

═══════════════════════════════════════════════════════════════
ORDER (STRICT)
═══════════════════════════════════════════════════════════════
0. Inventory
   Confirm Privacy VEIL (not /mnt/external). Count live turbos in src/turbos vs manifest. Confirm generate-veil-catalog.mjs still emits 800/4000. List RNK URLs VEIL actually opens (today: almost none).

1. Kill useless catalog
   Stop prebuild from generating stubs.
   Replace veil-manifest.json (src/ + public/) with a short hand-written catalog: kept engines + 9 live turbos only, status live/stable matching src/.
   Delete or gut generate-veil-catalog.mjs so it cannot emit pads (or make it write the tiny catalog only).
   Runtime must not claim 800 engines.

2. Browser 100%
   Tabs, omnibox, bookmarks, history, downloads, settings, fail-closed navigate_tab, live turbos wired.
   Finish main.js cutover to extracted modules if still a blob.
   Tests: policy unauthenticated → block; authenticated internal veil:// → allow; missing Tauri in production → no silent allow (dev fallback stays DEV-only).

3. Gate
   Production auth = C.O.M.M.A.N.D. / Resolute session, not veil-odinn codes as the product.
   Shortcodes: DEV/bootstrap only, labeled, off in production builds.
   Biosig stubs must still never return success.

4. VEIL-only access
   After session, VEIL attaches an attestation on requests to RNK product hosts (header name documented, not a secret in git).
   Privileged tab list: raven, echonet, mail.rnk-enterprise.us, demo.rnk-enterprise.us (product, not pentest), C.O.M.M.A.N.D. surfaces as needed.
   sec.rnk-enterprise.us stays out of the default agent chrome (private pentest).
   Minimal refuse-if-no-attestation on Raven/Mail/Echonet login+API. If you cannot touch those trees, FULL STOP and list the exact files — do not pretend VEIL policy on Chrome is enough.

5. Chrome sections
   Browser = default.
   Lisa section → P.R.O.T.E.C.T.S. organ health (Resolute), not veil-lisa-assistant stub chat as production.
   Comms → Echonet webview inside VEIL.
   Ops/People → Raven webviews inside VEIL (CRM + people). Placeholders “Coming soon” are not 100%.
   Server Control → Resolute/P.R.O.T.E.C.T.S., not localhost:7700 Lisa layer1 as the mind.

6. Docs
   VEIL.md + README: only client; catalog size truth; C.O.M.M.A.N.D. gate; Privacy path.
   Do not rewrite every product Rules file. VEIL Rules Q06 may get a short nits pass: VEIL is the only client.

7. STOP. Report:
   - engine/turbo counts before vs after
   - files deleted/gutted in the catalog mill
   - auth: C.O.M.M.A.N.D. wired or fail-closed HOLD
   - which RNK APIs now refuse non-VEIL
   - cargo/webkit HOLD if this host cannot build
   - remaining Coming-soon sections

═══════════════════════════════════════════════════════════════
VERIFY BAR
═══════════════════════════════════════════════════════════════
[1] All VEIL work under /media/odinn/privacy-system/VEIL except the tiny attestation hooks in Raven/Mail/Echonet/Website-demo
[2] Manifest engines+turbos ≤ ~20 real entries; no 800/4000
[3] src/turbos still has the 9 live implementations; they are what the manifest calls live
[4] Unauthenticated navigate → block
[5] Production build has no veil_dev_bypass path
[6] Biosig stub strings still cannot authenticate
[7] README does not say /mnt/external/VEIL as SoT
[8] Ghost crypto / P.R.O.T.E.C.T.S. organ src / Vortex untouched
[9] Honest last line: remaining HOLDs (C.O.M.M.A.N.D. URL, webkit SDK, products not yet refusing Chrome)
```
