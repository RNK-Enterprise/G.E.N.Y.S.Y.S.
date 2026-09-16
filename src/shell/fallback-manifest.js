/**
 * VEIL™ — offline manifest fallback
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * v3.0: real entries only (mirrors scripts/generate-veil-catalog.mjs).
 * The 800/4000 stub catalog was retired 2026-09-06 — do not pad this back.
 */
window.FALLBACK_VEIL_MANIFEST = {
  manifest_version: '3.0',
  product: 'VEIL',
  client: 'VEIL',
  surface_defaults: ['window', 'tabbar', 'omnibox', 'toolbar', 'sidebar', 'settings', 'statusbar', 'performance-panel'],
  catalog_summary: { engines: '8', turbos: '9', live_turbos: '9', stubs: '0', mode: 'offline', source: 'VEIL' },
  capabilities: [
    { id: 'veil-browser-core', name: 'Browser Core', kind: 'engine', category: 'browser', status: 'stable', surface: 'browser', priority: 'core', description: 'Windowing, tabs, omnibox, navigation, page lifecycle.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['browser', 'veil'] },
    { id: 'veil-security-stack', name: 'Security Stack', kind: 'engine', category: 'security', status: 'stable', surface: 'policy', priority: 'core', description: 'P.R.O.T.E.C.T.S. navigation policy, fail-closed gate.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['security', 'veil'] },
    { id: 'veil-performance-stack', name: 'Performance Stack', kind: 'engine', category: 'performance', status: 'stable', surface: 'performance-panel', priority: 'core', description: 'Runtime for the 9 live turbos.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['performance', 'veil'] },
    { id: 'veil-privacy-stack', name: 'Privacy Stack', kind: 'engine', category: 'privacy', status: 'stable', surface: 'browser', priority: 'core', description: 'Session hygiene, cross-origin isolation, attestation.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['privacy', 'veil'] },
    { id: 'veil-downloads', name: 'Downloads', kind: 'engine', category: 'browser', status: 'stable', surface: 'sidebar', priority: 'core', description: 'Download queue and file actions.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['browser', 'veil'] },
    { id: 'veil-bookmarks', name: 'Bookmarks', kind: 'engine', category: 'browser', status: 'stable', surface: 'sidebar', priority: 'core', description: 'Bookmark CRUD and bookmarks bar.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['browser', 'veil'] },
    { id: 'veil-history', name: 'History', kind: 'engine', category: 'browser', status: 'stable', surface: 'sidebar', priority: 'core', description: 'Visited pages and clear controls.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['browser', 'veil'] },
    { id: 'veil-settings', name: 'Settings', kind: 'engine', category: 'browser', status: 'stable', surface: 'settings', priority: 'core', description: 'Preferences including performance turbos.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['browser', 'veil'] },
    { id: 'turbo-tab-suspend', name: 'Tab Suspend', kind: 'turbo', category: 'performance', status: 'live', surface: 'performance-panel', priority: 'core', description: 'Suspend inactive iframe tabs to cut CPU/memory.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['performance', 'live', 'veil'] },
    { id: 'turbo-memory-reclaim', name: 'Memory Reclaim', kind: 'turbo', category: 'performance', status: 'live', surface: 'performance-panel', priority: 'core', description: 'Periodic reclaim of suspended tab documents and heap hints.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['performance', 'live', 'veil'] },
    { id: 'turbo-nav-prefetch', name: 'Nav Prefetch', kind: 'turbo', category: 'performance', status: 'live', surface: 'performance-panel', priority: 'core', description: 'Prefetch likely next hosts after policy allow.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['performance', 'live', 'veil'] },
    { id: 'turbo-dns-cache', name: 'DNS Cache', kind: 'turbo', category: 'performance', status: 'live', surface: 'performance-panel', priority: 'core', description: 'Cache host resolutions via native lookup.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['performance', 'live', 'veil'] },
    { id: 'turbo-render-throttle', name: 'Render Throttle', kind: 'turbo', category: 'performance', status: 'live', surface: 'performance-panel', priority: 'core', description: 'Throttle work on hidden tabs and low FPS.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['performance', 'live', 'veil'] },
    { id: 'turbo-image-lazy-shell', name: 'Image Lazy Shell', kind: 'turbo', category: 'performance', status: 'live', surface: 'performance-panel', priority: 'core', description: 'Lazy-load non-critical shell imagery.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['performance', 'live', 'veil'] },
    { id: 'turbo-cache-budget', name: 'Cache Budget', kind: 'turbo', category: 'performance', status: 'live', surface: 'performance-panel', priority: 'core', description: 'Enforce max cache and prune session blobs.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['performance', 'live', 'veil'] },
    { id: 'turbo-startup-defer', name: 'Startup Defer', kind: 'turbo', category: 'performance', status: 'live', surface: 'performance-panel', priority: 'core', description: 'Defer non-critical panels until idle.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['performance', 'live', 'veil'] },
    { id: 'turbo-network-idle', name: 'Network Idle', kind: 'turbo', category: 'performance', status: 'live', surface: 'performance-panel', priority: 'core', description: 'Coalesce status/perf polling when idle.', requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: ['performance', 'live', 'veil'] },
  ],
  engines: [],
  turbos: [],
};
