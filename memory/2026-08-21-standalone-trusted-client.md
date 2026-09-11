# 2026-08-21 — Axis standalone trusted client pass

## Intent

Make Axis a standalone Tauri privacy browser: fail-closed Lisa policy, local auth, no Atlas dependency, massive local engine/turbo catalog with live performance turbos, trusted-client auth harden, structural split toward LOC cap.

## Agreed

- Fail-closed when policy unreachable
- No Atlas — local engines/turbos
- Massive catalog with many stubs; critical turbos fully live
- Full trusted-client depth this pass

## Done

### Fail-closed + embedded Lisa

- `src-tauri/src/lisa_policy.rs` — in-process policy; remote optional; panic/error → block
- `src-tauri/src/main.rs` — uses local policy; `LISA_URL` optional; session default `locked`
- `src/lisa-bridge.js` — invoke failure / missing policy → block (no fail-open)

### Auth harden

- `src-tauri/src/auth.rs` — local `AXIS_ACCESS_CODES` (`axis-odinn`, `axis-agent` defaults)
- `src/axis-auth-gate.js` — Tauri `auth_resolve_code`; prod bypass removed; Mother Lisa stub labeled

### Standalone engines/turbos

- `scripts/generate-axis-catalog.mjs` → **800 engines / 4000 turbos / 9 live**
- `src/engines/runtime.js` + `catalog-loader.js` replace Atlas Bridge
- Live turbos under `src/turbos/` (suspend, reclaim, prefetch, DNS, render throttle, image lazy, cache budget, startup defer, network idle)
- Manifest at `public/axis-manifest.json` and `src/axis-manifest.json`

### Packaging / docs

- `AXIS.md`, README rewrite, `agent/AXIS.md`
- Bundle id `com.rnk.axis`, crate `rnk-axis`
- Vite serves catalog; smoke: `http://localhost:1420/` + assets 200

## Partial / follow-up

- `main.js` still large (~7k); extracted drafts in `src/ui/toast.js`, `src/ui/loading.js`, `src/perf/performance-monitor.js` — full import cutover / TabManager extract remains
- `cargo check` needs `javascriptcoregtk-4.0` on this host (Tauri webkit deps) — code structured for build where SDK present
- Mother Lisa biosig/FIDO still stubs by design
- Ghost `chain` still signal-only

## Verify

1. `npm run catalog && npm run dev:vite` — auth gate visible; with `axis_dev_bypass` in DEV, shell loads; status shows engine/turbo counts
2. Tauri (with webkit deps): login `axis-odinn` → new tab `axis://newtab`; external nav uses policy; no Atlas process
3. Grep confirms no `fail_open` in Axis src

## Default codes

`axis-odinn:full:creator`, `axis-agent:agent:agent` (override via `AXIS_ACCESS_CODES`)

## main.js split — in progress (handoff)

- Goal: every hand-written `src/**/*.js` ≤500 LOC; `main.js` thin orchestrator (auth → initializeApp → axisRuntime → LISA → tabs).
- Done so far:
  - `src/session/session-manager.js`, `src/session/recently-closed-manager.js` (ESM + `window.*`)
  - `src/shell/eval-chunk.js` (optional global-eval helper)
  - `scripts/split-main.mjs` (acorn-based extractor; needs a shell session to run)
- Still needed: run splitter, fix any >500 files (esp. spotlight-suggestions, TabManager, chrome-bindings), write thin `main.js`, `node --check` all changed files, `wc -l`, append “main.js split closed” note here.
- Do not touch Privacy Archives / Contabo / other RNK dirs; do not recreate `.AAA` paths.
- Prefer `window` for shared helpers/state to avoid circular ESM imports. Keep existing imports in main for managers, lisa-bridge, server-control, engines/runtime, catalog-loader, ui/toast, ui/loading, perf/performance-monitor.

## Open items closed (2026-08-21 later)

### main.js split
- Thin orchestrator `src/main.js` (~150 LOC)
- Modules under `src/shell/`, `src/browser/`, `src/ui/`, `src/session/` — hand-written files ≤500 LOC
- Auth race fixed: gate marks `hidden` immediately; boot accepts prior `__axisAuthenticated`

### cargo / WebKit
- Ubuntu 24.04: `.pkgconfig/` aliases 4.0 → 4.1
- `scripts/with-webkit-pc.sh` + npm `check:rust` / `build` wrappers
- Vendored `vendor/wry` patch adds `SettingsExt` import
- Valid PNG/ICO icons regenerated; broken icns removed from tauri.conf
- `cargo check` **green**

### E2E verification (Playwright Chromium → Vite :1420)
- Dev bypass hides gate; runtime starts; **9 live turbos** wired in UI
- Catalog **800 engines / 4000 turbos**
- New tab created; fail-closed blocks `https://example.com` without Tauri (`lisa_unreachable_fail_closed`)

### LOC cap closed
- `lisa-bridge.js` split → `src/lisa/lisa-bridge-pages.js` + `lisa-bridge-auth-ui.js`
- `density-surfaces.js` split → `density-surfaces-b.js`
- Final Playwright E2E: gate hidden, runtime connected, 9 turbos, 1 tab, fail-closed, **0 page errors**

## Atlas retirement + full browser functional pass (2026-09-06)

- Atlas is RETIRED. Axis is the restricted-access browser of the privacy system and must be fully functional standalone.
- P0 fixed: `window.normalizeUrl` / `window.navigateWithLISA` now exported from `lisa-bridge.js` (splitter had rewritten call sites to `window.*` without a bridge — tab restore and omnibox navigation crashed).
- P1 fixed: `lisa/lisa-bridge-auth-ui.js` rewritten — local `auth_resolve_code` only, no Atlas `/api/access/resolve`, undeclared `_authPanelEl`/`_session` refs removed.
- P1 fixed: `shell/tauri-api.js` prefers injected `window.__TAURI__` (works in prod `withGlobalTauri` builds; ESM import kept as bundler fallback).
- Atlas removal: capability ids `atlas-*` → `axis-*` (catalog generator + regenerated manifest, all JS/HTML/CSS references incl. `data-capability` CSS parity); window globals `atlasRuntime/atlasBridge/…` → `axisRuntime/axisBridge/…`; `AXIS_SURFACE_RULES`, `AXIS_SIDEBAR_COLLAPSIBLE_SECTIONS`, `AXIS_MANIFEST_URL`, `FALLBACK_AXIS_MANIFEST`; DOM ids/classes `atlas-sidebar-*` → `axis-sidebar-*` etc. with matching styles.css selectors. `atlas-manifest.json` aliases deleted.
- Outbound Atlas calls purged: dead `localhost:3000/health` 5s poll (status indicator now owned solely by engine runtime), assistant no longer POSTs chat history to Atlas (stub-only until LISA bridge product), admin-ops log/fleet fetches stubbed "source not wired".
- Privacy hardening: Google Fonts preconnect/stylesheet removed (system font stack), CSP font-src/style-src tightened in tauri.conf.json.
- Defaults corrected: homepage `axis://newtab`, search DuckDuckGo, theme `dark-neutral`, Home button → `axis://newtab`; missing `src/assets/logo.svg` created.
- Bug fixed: iframe `load` handler no longer overwrites `tab.url` with `about:srcdoc` (which leaked into history and got normalized into a bogus DuckDuckGo search on restore); new-tab srcdoc now titled "New Tab".
- Storage continuity: loads fall back to legacy `rnk-atlas-*` keys so existing bookmarks/history/settings/tabs survive the rename; obfuscated `legacyStoragePrefix` removed.
- FPS counter init bug fixed (`window.frameCount` was undefined → "NaN FPS").
- Verified in-browser (Vite :1420): boot green (runtime connected, 9 live turbos, 800 engines, 0 page errors), tab restore clean, omnibox navigation → LISA gate → allow loads; with dev bypass off, navigation fail-closed → block page injected; zero third-party network requests; UI fully styled.
- Rust `configure_atlas`/`check_atlas_health` remain as deprecated IPC aliases only (no callers in Axis frontend); `ATLAS_URL` env fallback retained for fleet Lisa endpoint reuse.

## Header consolidation (2026-09-06, later)

- Section nav (Browser/Lisa/Ops/People/Comms/Server/Admin) moved INTO the titlebar as a centered tab strip (`#section-nav` now lives in `.titlebar-center`); the standalone 34px nav row is gone — one header row total.
- "Roomy All" shell-density button removed from the titlebar (density stays in Settings → Appearance); "Zen" compact toggle kept. Removed button is safe: density code is null-safe (`shell-density-toggle` refs guard on element existence).
- Labels shortened for fit (Ops, Server) with full names in `title` attrs; `.section-nav-btn` restyled compact (22px height) with a divider between groups; nav click handling in `shell/section-nav.js` unchanged (event delegation on `#section-nav`).
- Verified in-browser: nav renders inside titlebar, all sections switch/mount correctly, browser section restores with tabs intact, no console errors.

## 2026-09-06 — Spotlight moved from sidebar to header (evidence)
- Sidebar SPOTLIGHT section removed (`shell/sidebar-render.js`, `shell/sidebar-utils.js` now placeholders; capability-activity refresh hooks point at the header renderer).
- New header dropdown: `#spotlight-wrap` in titlebar (⚡ button), module `shell/spotlight-suggestions.js` renders 12 contextual suggestions (nav/shell/bookmarks/history/downloads/perf/settings/link/security/ext/comms/auto) with context line from active tab.
- Wiring: `#spotlight-btn` click + Ctrl+K (`chrome-bindings-c.js`) toggle; filter-as-you-type in `#spotlight-search`; Enter runs first visible; Escape/outside-click close; filter resets on every open.
- Sidebar command palette + pinned-launcher + capability sections untouched and still render below.
- Verified live in preview: open/filter/execute/escape/Ctrl+K all pass, zero new console errors.

## 2026-09-06 — AXIS SHELL sidebar removed entirely (evidence)
- `<aside id="axis-sidebar">` (184 lines) and the ☰ `#sidebar-btn` deleted from `index.html`; ~300px of horizontal space reclaimed, webview now spans full width.
- `#axis-sidebar { display:none !important; }` in `styles.css` as a hard safety net; `window.renderAxisSidebar` is a no-op so all boot/refresh callers stay safe.
- `toggleAxisSidebarVisibility` and `focusAxisCommandPalette` now open the header Spotlight (Ctrl+K equivalent) — no dead buttons.
- Spotlight actions retargeted to real surfaces: Recently-closed modal (history), Settings sections (security/ext/automation), direct bookmark remove/add. No action opens a sidebar section anymore.
- Bug fixed en route: `rnk-axis-tabs` had ballooned to 437 tabs (31KB) from repeated test boots, stalling boot ~12s. `restoreTabs` is now idempotent (never restores over a live session), capped at 20 tabs, per-tab try/catch; `initializeApp` has a `__axisBooted` re-entry guard. Fresh session verified: exactly 1 tab, fast boot.
- Verified live: boot → no sidebar → Spotlight open/filter/execute/Escape all pass; second `axis:authenticated` dispatch does not duplicate tabs.

## 2026-09-11 — Tab close bug fixed (evidence)
- Tabs could not be closed: `closeTab()` called `window.tauriInvoke('close_tab', …)` but `window.tauriInvoke` was never assigned (splitter rewrote call sites to `window.*` without publishing the bridge — same bug class as the earlier `window.normalizeUrl` P0). The TypeError aborted `closeTab` before the tab was removed; Rust `close_tab` command was fine and registered all along.
- Fix: `lisa-bridge.js` now publishes `window.tauriInvoke = tauriInvoke` (alongside the existing `normalizeUrl`/`navigateWithLISA` globals); all 4 call sites (`close_tab`, `tab_window_activate`, `tab_window_history`, `tab_window_internal_load`) use optional call `window.tauriInvoke?.(…)` so a missing bridge degrades instead of crashing the close path.
- Verified: `node --check` on the 3 files, `vite build` clean (assignment + 4 guarded call sites present in bundle), `tauri build` Rust compile green (deb/rpm bundled; AppImage bundling step still needs the with-webkit HOME drill, pre-existing).

## 2026-09-11 — Global wiring audit (follow-up to tauriInvoke fix)
- Method: diffed every `window.X` read vs assignment across `src/**/*.js`, then intersected eslint `no-undef` hits (run with `--no-eslintrc --env browser,es2022 --parser-options=ecmaVersion:2022,sourceType:module`) with never-assigned names. Only true ReferenceErrors matter: bare-identifier calls resolve to `window.X` only if assigned somewhere.
- Found 2 genuine ReferenceError bugs, both in `surfaces-core.js` `renderAxisSearchSurface` (`getSearchProviderLabel`/`getSearchProviderState` called, never defined — splitter dropped the definitions). Currently masked by the early return for the removed `#axis-sidebar-search` DOM; would crash the moment that surface ever re-renders elsewhere. Fixed: both helpers implemented locally (read `window.currentSearchProvider`/`window.searchProviders` from chrome-bindings-b defensively).
- Fixed: `window.axisAuthSession` now published by `axis-auth-gate.js` in `persistSession` and deleted on both heartbeat fail-closed re-lock paths (section-nav tier read had only a sessionStorage fallback before).
- Fixed: `axisSectionChanged` hook (in splitter SHARED registry but never defined anywhere) now falls back to a `document`-level `axis:section-changed` CustomEvent instead of being silently skipped.
- Removed: dead `window.toggleDownloads?.()` fallback in spotlight-suggestions (nothing defines it; `openAxisDownloadsSection` is the real path and is wired).
- Post-fix scan: no-undef ∩ never-assigned is empty; remaining unassigned `window.*` reads are browser built-ins (`addEventListener/close/confirm/dispatchEvent/removeEventListener/scrollY/gc`), `__TAURI__` (Tauri-injected), `axisSectionChanged` (optional hook, now event-backed), `axisAuthSession` (optional read with sessionStorage fallback).
- Verified: `node --check` on 4 changed files, `vite build` clean, fixes present in emitted bundle.

## 2026-09-11 — Playwright E2E: tab close regression guard
- New: `playwright.config.js` + `e2e/tab-close.spec.js`, script `npm run test:e2e`. Runner is the installed `playwright` package's `playwright/test` subpath (no `@playwright/test` dependency needed); Chromium headless-shell v1234 downloaded into `~/.cache/ms-playwright`. `webServer` boots Vite on 1420 (reuseExistingServer off CI).
- Boot strategy: `addInitScript` seeds `axis_dev_bypass=true` (auth gate auto-authenticates, browser-safe before any native-only call), `axis-tour-complete`, `axis-cookies-accepted`; fresh context per test → no stale `rnk-axis-tabs` restore.
- Test flow: assert gate hidden + exactly 1 tab → `#new-tab-btn` → 2 tabs, second active → click `.tab-close` on it → back to 1 tab, survivor id unchanged and active; asserts persisted `rnk-axis-tabs` has 1 entry; collects `pageerror` and fails on any (the net that catches future `window.X is not a function` bugs).
- Bug the test caught immediately: `closeTab()`/`activateTab()` never called `saveTabs()` — the DOM updated but `rnk-axis-tabs` still held the closed tab, so it resurrected after restart. Both now persist; test green (2× runs) and `vite build` clean.

## 2026-09-11 — Vite wired into Tauri build (fresh assets in deb/rpm)
- Before: `beforeBuildCommand` was `echo Building frontend` (no-op) and `distDir: "../src"` — packaged apps shipped **raw unbundled src/**, not the Vite bundle.
- Now: `beforeBuildCommand: "npm run build:vite"` (new `build:vite` script; npm-run indirection keeps the hook CWD-proof — verified hook CWD = project root empirically), `distDir: "../dist"`. `beforeDevCommand` untouched (dev still serves :1420).
- Freshness proof chain for the packaged binary: hook-built `dist/assets/index-*.js` contained a planted marker (chunk `index-C4RQ5pxd.js`, 234,267 bytes) → tauri-codegen staged it **brotli-compressed** (staged file decompresses to exactly 234,267 bytes and staged HTML references the fresh chunk hash) → those staged bytes found verbatim inside the relinked `target/release/axis` (binary offset 459,411). tauri-build 1.5.6 emits `cargo:rerun-if-changed` on distDir (verified in vendored source), so frontend-only edits re-embed correctly.
- Note: plain `grep` cannot verify embedded assets — they are brotli-compressed at staging. Use `zlib.brotliDecompressSync` over `target/release/build/rnk-axis-*/out/tauri-codegen-assets/` instead.
- Release profile (`lto`, `codegen-units=1`) makes the crate link ~9–10 min; AppImage bundling step still fails in this sandbox (pre-existing; deb + rpm bundle fine).
- Marker removed after the proof run; clean rebuild kicked off so shipped bundles contain no marker.

## 2026-09-11 — Global-wiring audit as a build gate (scripts/audit-window-globals.mjs)
- The one-off shell audit became `scripts/audit-window-globals.mjs` (npm scripts `audit:globals`, and `prebuild:vite` → `npm run build:vite` → Tauri `beforeBuildCommand`, so **no package build can bundle an unwired global**).
- Mechanics: acorn AST (dev dep, already present) over all `src/**/*.js` → first-level `window.X`/`globalThis.X` reads/writes/deletes; deep chains (`window.tabManager.tabs`) track the **root** (`tabManager`) as the read. Guard-aware: `?.` chains, `window.X?.()`, `typeof`, if/ternary/logical-left tests, plus **control-flow guards** (`if (typeof window.X==='function'){window.X()}`, `window.X && …`, negated-check else-branch). Second pass: ESLint `Linter` API `no-undef` → bare names must have a `window.X` publisher somewhere. Failure modes: unguarded read w/o provider → exit 1; no-undef w/o provider → exit 1; guarded hook w/o provider → info only (extension point, never fatal). Optional baseline `scripts/.window-globals-baseline.json` (`--update-baseline`); currently empty.
- Current-tree result: 63 files, 303 window.* names (1121 reads, 513 writes/deletes), 0 failures; `window.axisSectionChanged` correctly classified as intentional optional hook.
- Self-test proof (seeded fixture, then removed): caught `window.ghostCommand('x')` (tauriInvoke class) AND bare `missingHelper(1,2)` (splitter class) → exit 1; `?.()`, typeof-guard, and provided globals all passed.
- Build-path proof: `npm run build:vite` shows `prebuild:vite` → audit OK → vite build exit 0.
- Env notes: under machine load (llama-server, load ~15) the eslint module import alone takes ~50s — audit needs a generous timeout; acorn parse of all src is ~100ms. Tool-session timeouts kill foreground cargo/npm runs: use `setsid bash -c '… > log 2>&1' &` for anything slow. Earlier stray finding: a walker with dangling-`else` silently scanned zero children — keep node-walkers' if/else braces explicit.

## 2026-09-11 — AXIS SHELL surface deletion: reconciliation + boot smoke test
- The sidebar-surface deletion wave left **5 regressions on disk**, every one found mechanically (audit gate + new smoke test) rather than by reading:
  1. `src/main.js` still imported the deleted `./shell/surfaces-extra.js` (unresolved import).
  2. `chrome-actions.js` published `window.setAxisSidebarHidden` / `focusAxisCommandPalette` / `createSidebarResult` — three functions the wave had deleted. Its export region was also triplicated and mangled.
  3. `bookmarks-bar.js` (recreated with only the live `renderBookmarksBar`) was imported by **nothing**, while `chrome-bindings.js` / `chrome-bindings-c.js` call `window.renderBookmarksBar()` unguarded.
  4. Two files stopped parsing: `sidebar-render.js` (`}window.SETTINGS_SECTION_RULES` — missing statement boundary) and `chrome-bindings-c.js` (the closing `}` of `loadSettings()` was eaten; same triplicated export tail).
  5. `capabilities.js` read `window.getAxisCapabilityActivityAction` / `…OpenLabel`, which died with `capability-activity.js`; its dead `createSidebarCapabilityCard` (removed-sidebar-DOM renderer, zero callers) was the only consumer.
- **Boot-killer, found by the new smoke test**: `sidebar-render.js` published `window.setAxisSidebarStateBadges = setAxisSidebarStateBadges;` — the *plural* function exists nowhere. The bare-identifier ReferenceError on the RHS aborts the whole module graph → `window.tabManager` is never defined → gate dismisses but the app creates **zero tabs**. Removed (plus the redundant self-assignment of `…StateBadgeFromCapability`).
- **Second smoke-test find, invisible to the audit**: the `src/newtab.html` inline script had `'Axis — RNK\\'s only client…'` — the doubled backslash closes the string early (`Unexpected identifier 's'`), so the tab-window / blocked-view page's script never ran at all. Now `\'`. Inline HTML scripts are outside the audit's `src/**/*.js` scope — that gap is why the smoke test matters.
- **Audit hardening** (closes the hole that missed the boot-killer): a write now only counts as a provider when it *really publishes a value*. `window.X = X` where `X` is not declared in that module (function/class/var/let/const/import) is recorded as a **self-write**, never excuses a read, and the failure output adds a note pointing at the line. Named function *expressions* deliberately do not count as declarations — their name is visible only inside themselves.
  - Proof: hardened audit on the pre-fix tree → `FAIL setAxisSidebarStateBadges (bare) — read but never provided` + `note: sidebar-render.js:129 … right-hand side is that same undefined name`, exit 1; after the fix → 56 files, 217 names, 0 failures, exit 0.
- New: `e2e/axis-boot.js` — shared `bootAxis` + `collectPageProblems` / `problemReport` (overlays pre-dismissed; records uncaught exceptions *and* console errors; Chromium reports failed subresource loads as console errors, so a missing page/chunk 404 also fails). New: `e2e/smoke.spec.js` — 3 tests: (a) shell boots = gate hidden, exactly 1 tab, omnibox visible, zero problems; (b) the globals the shell publishes are callable (`renderBookmarksBar`, `loadSettings`, `openSettings`/`closeSettings`, `updateStatusBar`, `getThemeLabel`, `applyThemeState`, `isAxisCapabilityAvailable`, `escapeHtml`, `setAxisStatusIndicator`, `togglePerformancePanel`) — the runtime counterpart to the static audit; (c) `newtab.html` boots clean. `e2e/tab-close.spec.js` now uses the shared helper and also asserts zero console errors.
- Evidence: smoke run on the broken tree = **3 failed**, reporting exactly `setAxisSidebarStateBadges is not defined` (shell, 0 tabs) and `Unexpected identifier 's'` (newtab); after the fixes **4/4 pass** (`npx playwright test`, 1.8s). `npm run build:vite` = audit OK + vite OK with `dist/index.html` **and** `dist/newtab.html` emitted.
- Known, pre-existing and out of scope: `npm test` (jest) has **no config and no unit tests** — default `testMatch` picks up the Playwright specs while jest scans the huge `src-tauri/target` tree, so it stalls for 400s+. `npm run test:e2e` is the real suite until jest gets a config with `testPathIgnorePatterns`.

## 2026-09-11 — Jest slot repaired (`npm test`)
- Before: **no jest config and no unit tests existed**. Jest's default `testMatch` swallowed the Playwright specs, and its haste crawl walked the whole repo — including `src-tauri/target` (GBs of Rust artifacts) — so `npm test` stalled past the 400s cap and never reported.
- Now: `jest.config.cjs` — `roots: ['<rootDir>/tests', '<rootDir>/src']` (crawl bounded, `target/` is never visited), `testPathIgnorePatterns: ['/node_modules/','/src-tauri/','/dist/','/e2e/']`, `testMatch: ['**/*.test.js']`, `testEnvironment: 'node'` (no jsdom installed), `transform: {}` (babel-jest is absent). `.js` is ESM via `"type": "module"` — Jest **rejects** `extensionsToTreatAsEsm: ['.js']` for it (validation error), and `--experimental-vm-modules` stays in the npm script.
- Timings: cold run 4m35s (cache build under load) → warm `npm test` = **0.66s wall / 0.165s jest time**; resolved config verified via `--showConfig` (roots, ignores, transform all as intended).
- First real unit tests: `tests/html-pages.test.js` (`@jest/globals` + acorn, both already installed) — (1) every inline `<script>` in every `src/*.html` parses, preserving module semantics and skipping `<script src=…>` bundles; (2) an extractor self-guard (a regex matching nothing would make (1) vacuous → asserts ≥2 inline scripts found and that the `type="module"` branch is exercised); (3) every `src/*.html` page is declared in `vite.config.js` `rollupOptions.input`. Tests (1) and (3) cover exactly the two HTML bugs that shipped earlier today: the `RNK\\'s` string that killed the newtab inline script, and `newtab.html` missing from the bundle (tab windows 404).
- Teeth proof (seeded fixture `src/tmp-broken-page.html` with a doubled backslash and no Vite input, then removed): tests (1) and (3) both failed with exit 1 naming the page; after removal 3/3 pass. Unchanged and re-verified: `npx playwright test` 4/4, `npm run build:vite` = audit OK + vite OK.

## 2026-09-11 — `npm run verify`: one-command gate (`scripts/verify.sh`) + Rust tab-window tests repaired
- New `scripts/verify.sh` behind npm `verify`. Four stages, cheap → expensive: **audit** (`audit-window-globals.mjs`), **unit** (jest), **e2e** (playwright), **rust** (`cargo test` in `src-tauri` through `with-webkit-pc.sh`). Each stage is a plain call to the existing npm script, so verify adds orchestration only — no check is reimplemented.
- Behaviour: by default **every stage runs even after one fails**, so a single run reports the whole picture; the report is a summary table with parsed evidence per stage (`56 files, 217 window.* names (…)`, `Tests: 3 passed, 3 total`, `4 passed (1.6s)`, `40 tests passed`), and exit 1 if any failed. `--fail-fast` stops at the first failure. Positional args select a subset (`npm run verify -- audit unit`, works through npm's `--`). `-v/--verbose` streams a stage live (`tee`) instead of capturing it. `--help` prints the header comment block; exit 2 on bad usage / missing prerequisite (per-stage preflight: `node_modules`, `cargo` on PATH). Logs: `/tmp/axis-verify/<stage>.log` (`AXIS_VERIFY_LOGDIR` overrides), and the last 20 lines of a failed stage's log are echoed inline.
- Gotcha hit while writing it: `usage()` first used a fixed `sed -n '2,30p'` range, which over-read past the comment block into live code. Now `sed -n '2,/^set -uo/p' | sed '$d'`.
- Timings (warm): full verify **4.5s** — audit 1s, jest 0.165s jest-time, playwright 4 passed / 1.6s, cargo 0s (cached). Cold rust compile dominates.
- **The new chain immediately caught a real failure**: the mock-runtime tab-window tests in `tab_windows_tests.rs` (written in the earlier turn) had **never compiled** — 23 errors. `TabWindows::state` was private (E0624 ×7); the mock test passed an owned `AppHandle<MockRuntime>` where the functions take `&AppHandle<R>` (E0308 ×15, at every `create_tab_window`/`close_tab_window`/`state` call site); `.copied()` on `Option<&TabWindowMeta>` (E0277, the struct isn't `Copy`). Fixes: `state` → `pub(crate) fn`, `&handle` at the call sites, `.cloned()`.
- After the fix `cargo test` = **40 passed**. Confirmed against tauri 1.8.3 `src/test/mock_runtime.rs` that the mock `WindowDispatcher` implements `show`/`hide`/`close`/`set_always_on_top`/`set_size`/`set_position`/`scale_factor`/`outer_position`, so the **real** `create_tab_window` → `close_tab_window` path runs headlessly: `close_tab_window_clears_bookkeeping_and_registry` creates `tab-7` through the real create path, asserts the runtime registry entry exists and bookkeeping has 1 entry, closes through the real close path, then asserts both the `windows` and `rects` maps are empty (plus idempotent re-close and never-created-id no-op tests).
- **Honest scope limit**: the mock runtime's `run_iteration()` is a no-op, so the `CloseWindow` message is never pumped and *OS-level* WebviewWindow destruction can't be observed headlessly. What is now pinned is the bookkeeping contract + registry visibility the shell depends on. The live-compositor proof remains the `[axis:tabwin]` lifecycle logging (`close tab-N: destroying WebviewWindow` → `journalctl --user | grep tabwin`), still unrun on this host because X11 automation times out under desktop load.
- Teeth proof of the harness itself: seeded `src/__verify_teeth.js` with `window.ghostVerifyCommand("probe")` → default mode = audit FAIL with `at src/__verify_teeth.js:2` **while the other three stages still ran** → `VERIFY FAILED: 3 passed, 1 failed`, exit 1; `--fail-fast` = audit only, exit 1; fixture removed → 4/4, exit 0.
- `README.md` script table refreshed: added `verify` + stage selection, split out the jest/e2e/audit rows, and dropped the stale `npm test (rust)` row that mislabeled Jest as the Rust runner.
- Relationship to `scripts/smoke-suite.sh`: smoke-suite stays the packaging/artifact gate (builds deb/rpm/AppImage, Xvfb launch-verify); `verify` is the fast dev-facing correctness gate. Its Phase 2 `cargo test` call is now duplicated in spirit, not in code.

## 2026-09-11 — push-time gates (pre-push hook + CI) and the LIVE tab-close proof (OS-level WebviewWindow destruction)
- **Push gate**: `.githooks/pre-push` (copyright header, `exec bash scripts/verify.sh --fail-fast`) + `npm run hooks:install` (`git config core.hooksPath .githooks`; verified resolved on this repo). Opt-out is documented in the header: `git push --no-verify`. Repo still has **no commits/remote** (everything untracked), so the gate arms itself on the first real push; its teeth were proven meanwhile by executing the hook directly: green pass in ~4.4s, and exit 1 refusing on a seeded `src/__pushgate_teeth.js` (`window.ghostPushProbe()`), fixture removed after.
- **CI gate**: `.github/workflows/verify.yml` — `ubuntu-24.04`, node 20, `npm ci`, `npx playwright install --with-deps chromium`, `libwebkit2gtk-4.1-dev` (+gtk3 dev) via apt, then `bash scripts/ci-verify.sh`, which reuses `scripts/with-webkit-pc.sh` unchanged because the committed `.pkgconfig/` shims are absolute symlinks to the system 4.1 files. Stage logs upload as artifacts on failure.
- **Live E2E proof, closing the mock-runtime's documented gap**: rebuilt the debug binary (43.9s cold; bin is `target/debug/rnk-axis`, NOT `axis` — and the killed build left a stale `target/debug/axis` orphan that `cargo` metadata kept claiming was fresh; content check via `strings | grep axis:tabwin` decided). Launched with `GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1` (X11 so xdotool can drive it; compositing off for WebKitGTK stability), stderr captured to /tmp/axis-live.log.
- **Drive sequence** (xdotool, all real user paths): typed `axis-odinn` into the auth gate + Enter → Ctrl+T (new tab) → Ctrl+L → typed `example.com` → Enter. Mechanics learned: Ctrl+T alone creates only a chrome-level tab (newtabs stay chrome-rendered); the **real WebviewWindow is created inside `navigate_tab` after policy allow**, triggered by the home button or a typed https URL. Typed `axis://newtab` would be search-mangled by the omnibox (no dot → search provider), hence example.com (policy: authenticated + https → `local_policy_allow`).
- **Create half**: journal `[axis:tabwin] create tab-2: url=https://example.com privileged=false → window live`; a real `Axis Tab` X window existed (`xdotool search --name '^Axis Tab$'` = 0x02800d14, `_NET_WM_PID` = 616654 = our process); WebKit helper processes 0 → 5.
- **Close half** (Ctrl+W): `[axis:tabwin] close tab-2: destroying WebviewWindow` then `[axis:tabwin] destroyed tab-2: OS webview window gone, dropping bookkeeping` — the second line is Tauri's `WindowEvent::Destroyed` firing for real. Three independent confirmations of OS-level destruction: (1) journal Destroyed event, (2) the `Axis Tab` X window vanished from the server (`xdotool search` empty after), (3) WebKit helper processes 5 → 4 (the tab's web process reaped; the loaded desktop transiently spawns extra helpers, so net delta — not exact count — is the honest metric). Main window stayed alive (app + `Axis` X window intact after close).
- Verification instance killed afterwards (`kill 616654`); no processes left behind. This closes the last open thread from the interrupted-turn backlog: headless mock-runtime tests pin the bookkeeping contract, and the live run proves actual WebviewWindow destroy in the compositor.
