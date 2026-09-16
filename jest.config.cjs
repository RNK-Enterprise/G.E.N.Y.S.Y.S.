/**
 * Axis™ — Jest config (unit tests)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Scope is the point: `roots` keeps Jest's crawl inside the unit-test dirs, so
 * it never walks `src-tauri/target` (GBs of Rust artifacts) and no longer
 * stalls. Playwright specs under `e2e/` are ignored here — they run with
 * `npm run test:e2e` — and the package is `"type": "module"`, so `.js` specs
 * are loaded as native ESM (requires `--experimental-vm-modules`, already in
 * the npm script).
 *
 * Write unit specs in `tests/`, or co-located next to a module under `src/`.
 */

module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  // `.js` is inferred as ESM from the package's "type": "module" — Jest
  // rejects extensionsToTreatAsEsm for it, and needs no transform (babel-jest
  // is not installed). Run with `--experimental-vm-modules`, as the script does.
  transform: {},
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/src-tauri/', '/dist/', '/e2e/'],
  // Build Rule 16: 100/100/100/100/100/100 — statements, branches, functions,
  // lines (x2), statements-per-file. The gate scopes to the logic modules that
  // run without a browser; DOM-coupled surfaces (shell, tab manager, bridge)
  // are covered by the Playwright e2e suite instead.
  collectCoverageFrom: [
    'src/bookmark-manager.js',
    'src/download-manager.js',
    'src/history-manager.js',
    'src/settings-manager.js',
    'src/engines/catalog-loader.js',
    'src/engines/runtime.js',
    'src/session/session-manager.js',
    'src/session/recently-closed-manager.js',
    'src/turbos/cache-budget.js',
    'src/turbos/dns-cache.js',
    'src/turbos/image-lazy-shell.js',
    'src/turbos/index.js',
    'src/turbos/memory-reclaim.js',
    'src/turbos/nav-prefetch.js',
    'src/turbos/network-idle.js',
    'src/turbos/render-throttle.js',
    'src/turbos/startup-defer.js',
    'src/turbos/tab-suspend.js',
  ],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/**/*.js': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};
