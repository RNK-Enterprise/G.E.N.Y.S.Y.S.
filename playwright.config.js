/**
 * GENYSYS™ — Playwright E2E configuration
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Browser-mode E2E against the Vite dev server (port 1420, strictPort in
 * vite.config.js). The Tauri IPC bridge is absent here; policy-bridge.js
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
    // Pin the host: on some CI runners vite's dev-server default binds ::1
    // only, which 127.0.0.1 probes never reach (and `url` cannot override
    // the bind, only the poll). --host pins both sides to IPv4 loopback.
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Playwright swallows webServer output by default; pipe it so a vite
    // crash names itself instead of surfacing as a bare poll timeout.
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
