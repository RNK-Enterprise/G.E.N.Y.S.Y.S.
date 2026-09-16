# E2E (Playwright)

Browser-mode tests against the Vite dev server (port 1420, strict). The Tauri IPC bridge is absent here; `lisa-bridge.js` fail-closes navigation, which is fine for shell-level tests. Run: `npm run test:e2e`. Config: `playwright.config.js` at the repo root.
