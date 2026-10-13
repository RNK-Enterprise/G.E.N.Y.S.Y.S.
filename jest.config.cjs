/**
 * GENYSYS™ — Jest config (unit tests)
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
  // HTML/CSS are only ever imported via `?raw` — the transformer turns the
  // file text into its default export so Vite's `?raw` semantics hold in Jest.
  // The two auth-gate modules get Vite-parity env emulation so the dev-bypass
  // branches (import.meta.env.DEV) are test-controllable.
  transform: {
    '^.+\\.(html|css)$': '<rootDir>/tests/helpers/raw-transform.cjs',
    'src/(lisa-bridge|genysys-auth-gate)\\.js$': '<rootDir>/tests/helpers/env-transform.cjs',
  },
  moduleNameMapper: {
    '^(.*)\\?raw$': '$1',
  },
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/src-tauri/', '/dist/', '/e2e/'],
  // Build Rule 16: 100/100/100/100/100/100 — every first-party source file,
  // every line. DOM-coupled surfaces (shell, tab manager, bridge, gate) are
  // covered through the jsdom shell harness suites in tests/, which boot the
  // real index.html and import the module graph in main.js order.
  collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js'],
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
