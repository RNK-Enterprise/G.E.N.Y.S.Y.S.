#!/usr/bin/env node
/**
 * VEIL catalog — TINY AND REAL.
 *
 * 2026-09-06: The 800-engine / 4000-turbo stub catalog was deleted on Odinn's
 * order. The browser only runs what is listed here: the real engine surfaces
 * plus the 9 live turbos implemented in src/turbos/. This script is
 * deterministic (no timestamps, no counters) so prebuild never fabricates
 * inventory. Edit this file to change the catalog — do not pad it.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── Real engine surfaces (browser jobs that actually exist in src/) ─────────
const ENGINES = [
  { id: 'veil-browser-core', name: 'Browser Core', category: 'browser', surface: 'browser', description: 'Windowing, tabs, omnibox, navigation, page lifecycle (src/browser).' },
  { id: 'veil-security-stack', name: 'Security Stack', category: 'security', surface: 'policy', description: 'P.R.O.T.E.C.T.S. navigation policy, fail-closed gate (src-tauri/lisa_policy.rs).' },
  { id: 'veil-performance-stack', name: 'Performance Stack', category: 'performance', surface: 'performance-panel', description: 'Runtime for the 9 live turbos (src/engines/runtime.js).' },
  { id: 'veil-privacy-stack', name: 'Privacy Stack', category: 'privacy', surface: 'browser', description: 'Session hygiene, cross-origin isolation, attestation (src/lisa-bridge.js).' },
  { id: 'veil-downloads', name: 'Downloads', category: 'browser', surface: 'sidebar', description: 'Download queue and file actions (src/download-manager.js).' },
  { id: 'veil-bookmarks', name: 'Bookmarks', category: 'browser', surface: 'sidebar', description: 'Bookmark CRUD and bookmarks bar (src/bookmark-manager.js).' },
  { id: 'veil-history', name: 'History', category: 'browser', surface: 'sidebar', description: 'Visited pages and clear controls (src/history-manager.js).' },
  { id: 'veil-settings', name: 'Settings', category: 'browser', surface: 'settings', description: 'Preferences including performance turbos (src/settings-manager.js).' },
];

// ── The 9 live turbos (implementations in src/turbos/) ──────────────────────
const LIVE_TURBOS = [
  { id: 'turbo-tab-suspend', name: 'Tab Suspend', implementation: 'tab-suspend', description: 'Suspend inactive iframe tabs to cut CPU/memory.' },
  { id: 'turbo-memory-reclaim', name: 'Memory Reclaim', implementation: 'memory-reclaim', description: 'Periodic reclaim of suspended tab documents and heap hints.' },
  { id: 'turbo-nav-prefetch', name: 'Nav Prefetch', implementation: 'nav-prefetch', description: 'Prefetch likely next hosts after policy allow.' },
  { id: 'turbo-dns-cache', name: 'DNS Cache', implementation: 'dns-cache', description: 'Cache host resolutions via native lookup.' },
  { id: 'turbo-render-throttle', name: 'Render Throttle', implementation: 'render-throttle', description: 'Throttle work on hidden tabs and low FPS.' },
  { id: 'turbo-image-lazy-shell', name: 'Image Lazy Shell', implementation: 'image-lazy-shell', description: 'Lazy-load non-critical shell imagery.' },
  { id: 'turbo-cache-budget', name: 'Cache Budget', implementation: 'cache-budget', description: 'Enforce max cache and prune session blobs.' },
  { id: 'turbo-startup-defer', name: 'Startup Defer', implementation: 'startup-defer', description: 'Defer non-critical panels until idle.' },
  { id: 'turbo-network-idle', name: 'Network Idle', implementation: 'network-idle', description: 'Coalesce status/perf polling when idle.' },
];

const manifest = {
  manifest_version: '3.0',
  product: 'VEIL',
  client: 'VEIL',
  catalog_summary: {
    engines: String(ENGINES.length),
    turbos: String(LIVE_TURBOS.length),
    live_turbos: String(LIVE_TURBOS.length),
    stubs: '0',
    mode: 'real-only',
    source: 'VEIL',
  },
  surface_defaults: [
    'window', 'tabbar', 'omnibox', 'toolbar', 'sidebar',
    'settings', 'statusbar', 'performance-panel',
  ],
  // capabilities mirrors the real entries only — consumers that gate on
  // capability availability (sidebar, spotlight, palette) must never see fakes.
  capabilities: [
    ...ENGINES.map((e) => ({
      id: e.id,
      name: e.name,
      kind: 'engine',
      category: e.category,
      status: 'stable',
      surface: e.surface,
      priority: 'core',
      description: e.description,
      requires_auth: false,
      requires_network: false,
      dependencies: [],
      fallback: 'local',
      owner: 'veil-local',
      version: '0.1.0',
      tags: [e.category, 'veil'],
    })),
    ...LIVE_TURBOS.map((t) => ({
      id: t.id,
      name: t.name,
      kind: 'turbo',
      category: 'performance',
      status: 'live',
      surface: 'performance-panel',
      priority: 'core',
      description: t.description,
      requires_auth: false,
      requires_network: false,
      dependencies: [],
      fallback: 'local',
      owner: 'veil-local',
      version: '0.1.0',
      tags: ['performance', 'live', 'veil'],
    })),
  ],
  engines: ENGINES.map((e) => ({
    id: e.id,
    name: e.name,
    kind: 'engine',
    category: e.category,
    surface: e.surface,
    status: 'live',
    priority: 'core',
    description: e.description,
    requires_auth: false,
    requires_network: false,
    implementation: 'local',
    tags: [e.category, 'veil'],
  })),
  turbos: LIVE_TURBOS.map((t) => ({
    id: t.id,
    name: t.name,
    kind: 'turbo',
    category: 'performance',
    status: 'live',
    priority: 'core',
    description: t.description,
    requires_auth: false,
    requires_network: false,
    implementation: t.implementation,
    tags: ['performance', 'live', 'veil'],
  })),
};

const outPublic = join(root, 'public', 'veil-manifest.json');
const outSrc = join(root, 'src', 'veil-manifest.json');
mkdirSync(dirname(outPublic), { recursive: true });
mkdirSync(dirname(outSrc), { recursive: true });
const json = JSON.stringify(manifest);
writeFileSync(outPublic, json);
writeFileSync(outSrc, json);

console.log(
  `Wrote VEIL catalog: ${ENGINES.length} engines, ${LIVE_TURBOS.length} live turbos, 0 stubs`,
);
