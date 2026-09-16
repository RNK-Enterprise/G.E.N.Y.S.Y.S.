# Changelog

All notable changes to VEIL™ are documented here. The deep, evidence-level
journal lives in `memory/2026-08-21-standalone-trusted-client.md`; this file is
the browsable distillation. Dates refer to the work's journal entries; versions
mark tagged states of the repository.

## [Unreleased] — 2026-09-16

### Fixed

- **The Axis→VEIL rename was completed in code identifiers.** Docs and paths
  had been renamed, but the code still disagreed with itself: src published
  mixed-case globals (`loadVEILManifest`, `isVEILCapabilityAvailable`,
  `applyVEILRuntimeStatus`, …) while the test and e2e suites called
  lowercased `veil` spellings that do not exist — 39 unit tests failed. All
  call sites now use the canonical mixed-case names. The six dead `VEIS_*`
  names (`FALLBACK_VEIS_MANIFEST`, `VEIS_MANIFEST_URL`, `VEIS_SURFACE_RULES`)
  are gone, as is the DEV-only `axis_dev_bypass` localStorage alias in the
  auth gate and LISA bridge (the `veil_dev_bypass` flag remains the only
  dev-bypass key, still gated behind `import.meta.env.DEV`).
- **Legacy localStorage migration now actually migrates.**
  `veil-welcome-tour.js` and `veil-cookies-bar.js` copied the pre-rename
  `axis-*` keys but never deleted them, so the lift re-ran on every boot.
  Both now remove the legacy key after a successful copy.
- **Icon set completion.** `icon.icns` was generated but never referenced by
  `tauri.conf.json` — macOS bundles would have shipped the default Tauri icon;
  it is now in the bundle icon list. The chrome pages (`index.html`,
  `newtab.html`) carried no `<link rel="icon">`, so tab surfaces fell back to
  the browser default; both now point at the real `assets/logo.svg` mark. The
  generator (`scripts/render-icons.mjs`) also survives Playwright pinned-build
  cache skew by falling back to the newest cached Chromium, and was re-run:
  output is byte-identical to the committed set.
- **Build Rule 1 gaps closed.** `.pkgconfig/`, `.pkgconfig/lib/`, and
  `tests/helpers/` had no `.gitignore`/`README.md`; all three are documented
  now (the pkg-config shims are tracked on purpose — they are part of the
  build) and `LOC_REPORT.md` was regenerated.

### Changed

- **Rebrand: midnight blue + ice.** The gold / "toxic green" accent scheme is
  retired. Base tokens are midnight surfaces (`#10192b` / `#0a1120` /
  `#16223a`) with an ice-blue accent `#8ab4f8`; the legacy `--toxic-green` /
  `--brand-gold` variable names remain as aliases pointing at the ice values,
  so the entire var-driven surface recolored without churn. Six accent/shadow
  variables (`--accent`, `--accent-bg`, `--hover-bg`, `--border-toxic`,
  `--shadow-toxic`, `--shadow-deep`) that were *used but never defined* are
  now defined. Hardcoded color literals were swept from every stylesheet, the
  auth-gate and Ops backgrounds, `newtab.html`, the Lisa bridge inline SVG,
  the perf-monitor chart stroke, and the settings accent default.
- **New mark.** `src/assets/logo.svg` is three layered veil swags — each more
  transparent than the last, privacy in layers — over a star marking what is
  protected, set in a midnight drape badge (the old gold hexagon is retired);
  the auth gate shows the real mark instead of a `⬡` glyph. The full Tauri
  icon set
  (32/128/256 PNG, `icon.ico`, `icon.icns`) is regenerated from it by the new
  `scripts/render-icons.mjs`, which rasterizes via Playwright Chromium — this
  host's ImageMagick has no working SVG delegate — and pixel-checks the
  rendered accent before writing.

## [0.1.0] — 2026-09-12

First tagged release. The state of the tree after: standalone re-architecture,
tab-window browser model, the full verification stack, and CI that proves both
source correctness and packaged artifacts.

### Fixed

- **Tabs could not be closed.** `closeTab()` invoked `window.tauriInvoke`, but
  the module splitter had rewritten call sites to `window.*` without ever
  publishing the bridge — a TypeError aborted every close before the tab was
  removed. The bridge global is now published and all four call sites use
  optional-call so a missing bridge degrades instead of crashing.
- **Closed tabs resurrected after restart.** `closeTab()`/`activateTab()` never
  persisted; the DOM updated but stored tab state still held the closed tab.
- **Boot-killer:** `window.setVEILSidebarStateBadges = <undefined>` aborted the
  entire module graph at load, so the app rendered its gate and created *zero
  tabs*. The global-wiring audit was hardened (self-writes never count as
  providers) so this class can never pass the build again.
- **Tab-window page never ran:** the `newtab.html` inline script had a doubled
  backslash (`RNK\\'s`) that closed its string early — the whole tab-window /
  blocked-view page script failed to parse. Inline HTML scripts are now guarded
  by a Jest unit test the JS audit structurally cannot cover.
- Two latent ReferenceErrors in `renderVEILSearchSurface` (splitter dropped the
  `getSearchProviderLabel`/`getSearchProviderState` definitions), masked only by
  an early return on removed DOM.
- iframe `load` handler overwriting `tab.url` with `about:srcdoc` (leaked into
  history and normalized into a bogus search on restore).
- Stale session restore: `restoreTabs` re-created 437 accumulated test tabs and
  stalled boot ~12s; now idempotent, capped, and re-entry-guarded.
- FPS counter `NaN`, auth/boot race (gate hidden too late), duplicate tab
  creation on a second `veil:authenticated` dispatch.

### Changed

- **Browser model:** the shell is chrome-only; each tab's content is a *real*
  `WebviewWindow`, created Rust-side only after a fail-closed P.R.O.T.E.C.T.S.
  policy allow. Every navigation passes an `on_navigation` gate before the
  request is issued — there is no "load and then decide" path. This replaces
  the old iframe design, whose cross-origin cookie partitioning broke RNK
  attestation.
- **Standalone:** Atlas is retired. Local engine/turbo catalog (800 engines /
  4000 turbos, 9 fully live), embedded local policy engine, local shortcode
  auth (`VEIL_ACCESS_CODES`); production auth is C.O.M.M.A.N.D. / Resolute and
  shortcodes are refused there (fail-closed HOLD).
- **Shell surface:** the VEIL SHELL sidebar and all its renderers/rules/exports
  are deleted (full-width content); Spotlight moved to the header (Ctrl+K);
  section nav consolidated into the titlebar.
- **Packaging truth:** `beforeBuildCommand` runs the real Vite build and
  `distDir` points at the bundle — packaged apps previously shipped *raw
  unbundled `src/`*. WebKitGTK 4.0→4.1 pkg-config shims make Tauri 1 build on
  Ubuntu 24.04; the .deb Depends line is rewritten to installable 4.1 packages.

### Added

- **Verification stack, chained behind `npm run verify`:**
  - *audit* — AST-based global-wiring gate (`audit:globals`): an unwired
    `window.*` read or bare identifier fails the build, not the runtime.
  - *unit* — Jest suite guarding HTML inline scripts and Vite inputs.
  - *e2e* — Playwright smoke (boot cleanliness, published globals callable,
    newtab page) and the tab-close regression guard; any console error fails.
  - *rust* — 40 tests including mock-runtime coverage of the real
    create→close tab-window bookkeeping path.
  - *live* (opt-in) — `verify-live.sh` launches VEIL, drives a real tab
    open/close with xdotool, and asserts OS-level WebviewWindow destruction
    via the `[veil:tabwin]` journal lines; runs headless under Xvfb.
- **Push-time enforcement:** `.githooks/pre-push` (via `npm run hooks:install`)
  runs the gate fail-fast before any push; the CI `verify` workflow runs the
  same gate on every push, and the `package` job builds the .deb/.rpm/AppImage,
  runs the packaging smoke suite (integrity, freshness, dependency sanity,
  headless launch-verify), and re-runs the headless compositor proof.
- `[veil:tabwin]` lifecycle journaling for tab-window create/close/destroyed.

## Links

- Evidence journal: `memory/2026-08-21-standalone-trusted-client.md`
- Verification entry points: `npm run verify`, `npm run verify:live`,
  `bash scripts/smoke-suite.sh` (packaging), `.github/workflows/verify.yml`
