# Changelog

All notable changes to Axis™ are documented here. The deep, evidence-level
journal lives in `memory/2026-08-21-standalone-trusted-client.md`; this file is
the browsable distillation. Dates refer to the work's journal entries; versions
mark tagged states of the repository.

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
- **Boot-killer:** `window.setAxisSidebarStateBadges = <undefined>` aborted the
  entire module graph at load, so the app rendered its gate and created *zero
  tabs*. The global-wiring audit was hardened (self-writes never count as
  providers) so this class can never pass the build again.
- **Tab-window page never ran:** the `newtab.html` inline script had a doubled
  backslash (`RNK\\'s`) that closed its string early — the whole tab-window /
  blocked-view page script failed to parse. Inline HTML scripts are now guarded
  by a Jest unit test the JS audit structurally cannot cover.
- Two latent ReferenceErrors in `renderAxisSearchSurface` (splitter dropped the
  `getSearchProviderLabel`/`getSearchProviderState` definitions), masked only by
  an early return on removed DOM.
- iframe `load` handler overwriting `tab.url` with `about:srcdoc` (leaked into
  history and normalized into a bogus search on restore).
- Stale session restore: `restoreTabs` re-created 437 accumulated test tabs and
  stalled boot ~12s; now idempotent, capped, and re-entry-guarded.
- FPS counter `NaN`, auth/boot race (gate hidden too late), duplicate tab
  creation on a second `axis:authenticated` dispatch.

### Changed

- **Browser model:** the shell is chrome-only; each tab's content is a *real*
  `WebviewWindow`, created Rust-side only after a fail-closed P.R.O.T.E.C.T.S.
  policy allow. Every navigation passes an `on_navigation` gate before the
  request is issued — there is no "load and then decide" path. This replaces
  the old iframe design, whose cross-origin cookie partitioning broke RNK
  attestation.
- **Standalone:** Atlas is retired. Local engine/turbo catalog (800 engines /
  4000 turbos, 9 fully live), embedded local policy engine, local shortcode
  auth (`AXIS_ACCESS_CODES`); production auth is C.O.M.M.A.N.D. / Resolute and
  shortcodes are refused there (fail-closed HOLD).
- **Shell surface:** the AXIS SHELL sidebar and all its renderers/rules/exports
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
  - *live* (opt-in) — `verify-live.sh` launches Axis, drives a real tab
    open/close with xdotool, and asserts OS-level WebviewWindow destruction
    via the `[axis:tabwin]` journal lines; runs headless under Xvfb.
- **Push-time enforcement:** `.githooks/pre-push` (via `npm run hooks:install`)
  runs the gate fail-fast before any push; the CI `verify` workflow runs the
  same gate on every push, and the `package` job builds the .deb/.rpm/AppImage,
  runs the packaging smoke suite (integrity, freshness, dependency sanity,
  headless launch-verify), and re-runs the headless compositor proof.
- `[axis:tabwin]` lifecycle journaling for tab-window create/close/destroyed.

## Links

- Evidence journal: `memory/2026-08-21-standalone-trusted-client.md`
- Verification entry points: `npm run verify`, `npm run verify:live`,
  `bash scripts/smoke-suite.sh` (packaging), `.github/workflows/verify.yml`
