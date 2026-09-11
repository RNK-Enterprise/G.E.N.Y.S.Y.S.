/**
 * Axis™ — Playwright E2E configuration
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Browser-mode E2E against the Vite dev server (port 1420, strictPort in
 * vite.config.js). The Tauri IPC bridge is absent here; lisa-bridge.js
 * fail-closes navigation, which is fine for shell-level tests like tabs.
 */

import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  timeout: 30_000,

  use: {
    baseURL: 'http://127.0.0.1:1420',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
