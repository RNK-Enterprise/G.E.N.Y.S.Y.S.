/**
 * GENYSYS™ — shared E2E boot helpers
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * One boot path for every spec: the auth gate, welcome tour, and cookie bar
 * are pre-dismissed from localStorage so a spec can reach the shell directly.
 * `collectPageProblems` records everything the page reports as broken —
 * uncaught exceptions and console errors. Chromium logs failed subresource
 * loads (a missing /newtab.html, a 404 chunk) as console errors, so this also
 * catches the packaging class of regression.
 */

/** Fresh-context state that gets the shell up without native auth. */
const BOOT_STATE = {
  genysys_dev_bypass: 'true', // auth gate auto-authenticates (no native shell)
  'genysys-tour-complete': '1', // no welcome tour
  'genysys-cookies-accepted': '1', // no cookie notice
};

/**
 * Attach listeners before navigation. Call this *before* `bootGENYSYS` if you
 * need a collector, or just use the one `bootGENYSYS` returns.
 */
export function collectPageProblems(page) {
  const problems = { consoleErrors: [], pageErrors: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') problems.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => problems.pageErrors.push(error.message || String(error)));
  return problems;
}

/** Flatten a collector into a readable, assertable list. */
export function problemReport(problems) {
  return [
    ...problems.pageErrors.map((entry) => `uncaught exception: ${entry}`),
    ...problems.consoleErrors.map((entry) => `console.error: ${entry}`),
  ];
}

/**
 * Boot GENYSYS in browser mode and return the problem collector for that page.
 * Each Playwright test gets a fresh context, so no stale tabs are restored.
 */
export async function bootGENYSYS(page, { path = '/' } = {}) {
  const problems = collectPageProblems(page);
  await page.addInitScript((state) => {
    for (const [key, value] of Object.entries(state)) localStorage.setItem(key, value);
  }, BOOT_STATE);
  await page.goto(path);
  return problems;
}
