# src/ — Axis frontend

Browser shell: HTML surfaces, JS modules, and the stylesheet manifest.

## Layout
- `index.html`, `newtab.html` — Vite entry pages (newtab is every tab window's page)
- `main.js` — thin boot orchestrator; import order is the wiring contract
- `styles.css` — `@import` manifest over `styles/` (order = cascade order; do not reorder)
- `browser/` — tab lifecycle; `shell/` — chrome bindings and section rendering
- `ui/` — density + toast/loading surfaces; `turbos/` — performance mods
- `engines/` — capability catalog loader and runtime; `session/` — session persistence
- `lisa/` — Lisa policy frontend

## Invariants
- Every module attaches to `window.*`; globals are audited by `npm run audit:globals`.
- No optional chaining in code that must survive Vite's `import.meta.env.DEV` replacement.
