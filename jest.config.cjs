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
};
