/**
 * GENYSYS™ — boot smoke test
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * The cheap, broad net: boot the real shell in browser mode and fail on *any*
 * uncaught exception or console error, then probe the globals the shell
 * publishes. This is the runtime counterpart to `npm run audit:globals` — the
 * static audit reads providers/reads from source, this catches an unwired
 * global (the 2026-09-11 `window.tauriInvoke` class) or a broken render path
 * the moment the app actually runs.
 */

import { test, expect } from 'playwright/test';
import { bootGENYSYS, problemReport } from './genysys-boot.js';

test('shell boots clean: one tab, no exceptions, no console errors', async ({ page }) => {
  const problems = await bootGENYSYS(page);

  // The shell really came up — not just an empty document.
  await expect(page.locator('#genysys-auth-gate')).toHaveClass(/hidden/);
  await expect(page.locator('#tabs .tab')).toHaveCount(1);
  await expect(page.locator('#omnibox')).toBeVisible();

  expect(problemReport(problems)).toEqual([]);
});

test('published shell globals are wired and callable', async ({ page }) => {
  const problems = await bootGENYSYS(page);
  await expect(page.locator('#tabs .tab')).toHaveCount(1);

  // Every probe below is a global some other module calls unguarded; when its
  // provider module is dropped (as happened when the GENYSYS SHELL sidebar was
  // removed) the call throws at runtime. Args are inert on purpose.
  const failures = await page.evaluate(() => {
    const withArg = new Set([
      'updateStatusBar',
      'getThemeLabel',
      'applyThemeState',
      'isGENYSYSCapabilityAvailable',
      'escapeHtml',
    ]);
    const probes = [
      'renderBookmarksBar',
      'loadSettings',
      'openSettings',
      'closeSettings',
      'updateStatusBar',
      'getThemeLabel',
      'applyThemeState',
      'isGENYSYSCapabilityAvailable',
      'escapeHtml',
      'setGENYSYSStatusIndicator',
      'togglePerformancePanel',
    ];

    const results = [];
    for (const name of probes) {
      if (typeof window[name] !== 'function') {
        results.push(`${name}: not published (unwired global)`);
        continue;
      }
      try {
        window[name](withArg.has(name) ? 'dark' : undefined);
      } catch (error) {
        results.push(`${name}: threw ${error.message}`);
      }
    }
    return results;
  });

  expect(failures).toEqual([]);
  expect(problemReport(problems)).toEqual([]);
});

test('newtab page boots clean (the tab-window page)', async ({ page }) => {
  const problems = await bootGENYSYS(page, { path: '/newtab.html' });

  // Tab windows and the blocked view both load this page; a 404 or a broken
  // inline script here would leave every opened tab blank.
  await expect(page.locator('#title')).toBeVisible();
  await expect(page.locator('#body-text')).toBeVisible();

  expect(problemReport(problems)).toEqual([]);
});
