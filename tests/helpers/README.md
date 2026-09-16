# Test helpers

Shared fixtures for the Jest suite, referenced from `jest.config.cjs` and
`tests/*.test.js`:

- `raw-transform.cjs` — serves HTML/CSS imports as raw text so Vite's
  `?raw` semantics hold under Jest.
- `env-transform.cjs` — Vite-parity env emulation for the auth-gate
  modules (`import.meta.env.DEV` branches become test-controllable).
- `shell-harness.js` — boots the real `index.html` and the `main.js`
  module graph inside jsdom for the shell suites.
