/**
 * Axis™ — tab close regression E2E
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Guards the tab close path (the 2026-09-11 `window.tauriInvoke` class of
 * regressions): open a second tab, close one with the × button, and assert
 * the tab list, activation, and persisted session all update — with zero
 * uncaught page errors (any `window.X is not a function` fails the test).
 */

import { test, expect } from 'playwright/test';
import { bootAxis, problemReport } from './axis-boot.js';

test('opens two tabs and closes one with the × button', async ({ page }) => {
  const problems = await bootAxis(page);

  // App booted: gate dismissed, exactly one initial tab, no overlays.
  const tabs = page.locator('#tabs .tab');
  await expect(page.locator('#axis-auth-gate')).toHaveClass(/hidden/);
  await expect(tabs).toHaveCount(1);
  const survivorId = await tabs.nth(0).getAttribute('data-tab-id');

  // Open a second tab via the real toolbar button.
  await page.locator('#new-tab-btn').click();
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(1)).toHaveClass(/active/);
  const closedId = await tabs.nth(1).getAttribute('data-tab-id');
  expect(closedId).not.toBe(survivorId);

  // Close the active (second) tab with its × button.
  await tabs.nth(1).locator('.tab-close').click();

  // Tab list shrinks back to one and the surviving tab is the first one.
  await expect(tabs).toHaveCount(1);
  await expect(tabs.nth(0)).toHaveAttribute('data-tab-id', survivorId);
  await expect(tabs.nth(0)).toHaveClass(/active/);

  // Omnibox follows the activation handoff.
  const savedTabs = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('rnk-axis-tabs') || '{"tabs":[]}'),
  );
  expect(savedTabs.tabs).toHaveLength(1);
  expect(savedTabs.tabs[0].title).toBeTruthy();

  // No uncaught exceptions or console errors anywhere in the close path.
  expect(problemReport(problems)).toEqual([]);
});
