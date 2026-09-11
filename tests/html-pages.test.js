/**
 * Axis™ — HTML page guards (unit)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Both tests here cover bugs that actually shipped once:
 *
 *  1. `scripts/audit-window-globals.mjs` only scans `src/**\/*.js`, so the
 *     inline scripts inside the HTML pages are invisible to it. One had
 *     `'Axis — RNK\\'s only client…'` — the doubled backslash closed the string
 *     early, the whole inline script failed to parse, and the newtab /
 *     blocked-view page (every tab window loads it) ran with no script at all.
 *
 *  2. `newtab.html` was once absent from Vite's `rollupOptions.input`, so the
 *     bundle shipped no newtab page and every tab window 404'd. Vite only
 *     builds pages reachable from a declared input.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from '@jest/globals';
import * as acorn from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const PAGES = readdirSync(SRC).filter((entry) => entry.endsWith('.html')).sort();

/**
 * Inline `<script>` bodies, with module semantics preserved. External bundles
 * (`<script src=…>`, the Vite entry points) are skipped — they are covered by
 * the build, not by this page-level check.
 */
function inlineScripts(html) {
  const found = [];
  const tag = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = tag.exec(html))) {
    const attrs = match[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue; // external bundle
    const typeMatch = /type\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const type = typeMatch ? typeMatch[1].toLowerCase() : '';
    if (type && type !== 'module' && !/javascript/.test(type)) continue; // JSON-LD etc.
    found.push({ source: match[2], module: type === 'module' });
  }
  return found;
}

const extracted = PAGES.flatMap((page) =>
  inlineScripts(readFileSync(path.join(SRC, page), 'utf8')).map((script) => ({ page, ...script })),
);

describe('src/*.html inline scripts', () => {
  test('every inline script parses', () => {
    const failures = [];
    for (const { page, source, module } of extracted) {
      try {
        acorn.parse(source, {
          ecmaVersion: 'latest',
          sourceType: module ? 'module' : 'script',
        });
      } catch (error) {
        failures.push(`${page}: ${error.message}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test('the extractor actually sees them (and skips the bundled entry scripts)', () => {
    // Without this, a regex that matches nothing would make the test above pass
    // vacuously. index.html and newtab.html each carry one inline script, and
    // index.html's is `type="module"` — so the module branch is exercised too.
    expect(extracted.length).toBeGreaterThanOrEqual(2);
    expect(extracted.some((script) => script.module)).toBe(true);
    expect(extracted.every((script) => script.source.trim().length > 0)).toBe(true);
  });
});

describe('Vite build inputs', () => {
  test('every src/*.html page is declared as an input', () => {
    const config = readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8');
    const missing = PAGES.filter((page) => !config.includes(`src/${page}`));
    expect(missing).toEqual([]);
  });
});
