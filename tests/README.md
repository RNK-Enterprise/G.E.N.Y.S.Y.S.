# Unit tests (jest)

Run: `npm test`.

Covers the frontend module graph under `src/` (shell, managers, turbos, engines, pages) via jsdom harnesses. Coverage thresholds are 100/100/100/100 on `src/**/*.js`.

Playwright specs live in `e2e/` (`npm run test:e2e`) against Vite on `127.0.0.1:1420`. Rust tests: `bash scripts/with-webkit-pc.sh cargo test --manifest-path src-tauri/Cargo.toml`.
