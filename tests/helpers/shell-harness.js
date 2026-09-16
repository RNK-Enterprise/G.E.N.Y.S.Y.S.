/**
 * VEIL™ — jsdom shell harness
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Boots the real index.html markup inside jsdom, stubs the Tauri bridge and
 * browser primitives jsdom lacks (fetch, rAF, canvas 2D, IntersectionObserver,
 * requestIdleCallback, matchMedia), then imports the shell module graph in
 * exact main.js order. Suites import `bootShell()` once per test file and
 * drive the published window.* surfaces — the same ones production code runs.
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { jest } from '@jest/globals';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');

export const STORAGE_OK = Symbol('storage-ok');

export function freshStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        get length() { return map.size; },
        key(i) { return [...map.keys()][i] ?? null; },
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => { map.set(k, String(v)); },
        removeItem: (k) => { map.delete(k); },
        clear: () => { map.clear(); },
    };
}

export function freshListeners() {
    const map = new Map();
    return {
        map,
        track(target) {
            target.addEventListener = (type, handler) => {
                const list = map.get(type) || [];
                list.push(handler);
                map.set(type, list);
            };
            target.removeEventListener = (type, handler) => {
                const list = map.get(type) || [];
                const i = list.indexOf(handler);
                if (i >= 0) list.splice(i, 1);
            };
        },
        fire(type, event = {}) {
            for (const handler of map.get(type) || []) handler(event);
        },
    };
}

export function stubCanvas(el) {
    const calls = [];
    el.getContext = () => ({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        fillRect: (...a) => calls.push(['fillRect', ...a]),
        beginPath: () => calls.push(['beginPath']),
        moveTo: (...a) => calls.push(['moveTo', ...a]),
        lineTo: (...a) => calls.push(['lineTo', ...a]),
        stroke: () => calls.push(['stroke']),
    });
    el.__calls = calls;
    return el;
}

let callSeq = 0;

export function stubTauri(overrides = {}) {
    const invocations = [];
    const listeners = new Map();
    const base = {
        invoke: async (cmd, args = {}) => {
            invocations.push({ cmd, args, seq: ++callSeq });
            const handler = overrides.invoke;
            if (handler) return handler(cmd, args);
            switch (cmd) {
                case 'navigate_tab':
                    return { decision: 'allow', reason: 'policy_ok', audit: true, notify: false, chain: false, domain: args.url, source: 'local' };
                case 'get_session_info':
                    return { accessTier: 'agent', shortcode: 'stub', deviceVerified: true, authenticated: true };
                case 'check_lisa_health':
                case 'check_veil_health':
                    return { connected: true, mode: 'local', localPolicy: true, lisaUrl: '' };
                case 'command_session_status':
                    return { phase: 'closed' };
                case 'cmd_gate_status':
                    return { hold: false, mode: 'dev' };
                case 'auth_resolve_code':
                    return { token: 'tok', tier: 'agent', agentId: 'agent-1', source: 'dev' };
                default:
                    return null;
            }
        },
        event: {
            listen: async (event, handler) => {
                const list = listeners.get(event) || [];
                list.push(handler);
                listeners.set(event, list);
                return () => {
                    const l = listeners.get(event) || [];
                    const i = l.indexOf(handler);
                    if (i >= 0) l.splice(i, 1);
                };
            },
        },
        __emit(event, payload) {
            for (const handler of listeners.get(event) || []) handler({ payload });
        },
        __invocations: invocations,
    };
    return base;
}

export function freshShellState() {
    // Module top-levels publish window.* only once per registry generation.
    // Tests reset the registry (resetModuleRegistry) before each boot so every
    // bootShell() re-evaluates the graph like a fresh page load.
}

export function resetModuleRegistry() {
    jest.resetModules();
}

// ── Listener audit ────────────────────────────────────────────────────────────
// jsdom's document/window persist for the whole test FILE, so document-level
// listeners from module top-levels (keydown, mousedown, …) and from earlier
// tests accumulate and double-fire. Track every addEventListener through the
// EventTarget prototype and drain them between tests.

const __originalAdd = EventTarget.prototype.addEventListener;
const __originalRemove = EventTarget.prototype.removeEventListener;
const __tracked = [];

if (!globalThis.__veilListenerAuditInstalled) {
    globalThis.__veilListenerAuditInstalled = true;
    EventTarget.prototype.addEventListener = function (type, handler, opts) {
        __tracked.push({ target: this, type, handler, opts });
        return __originalAdd.call(this, type, handler, opts);
    };
}

export function drainListeners() {
    jest.restoreAllMocks();
    while (__tracked.length) {
        const { target, type, handler, opts } = __tracked.pop();
        try {
            __originalRemove.call(target, type, handler, opts);
        } catch { /* target already gone */ }
    }
    for (const key of ['__veilWindowControlsBound', '__veilBooted', '__veilAuthenticated', 'veilAuthSession', 'tabWindowBridge']) {
        try { delete window[key]; } catch { /* non-configurable */ }
    }
}

export function stableCapability(id, category, surface) {
    return { id, name: id, kind: 'engine', category, status: 'stable', surface, priority: 'core', description: id, requires_auth: false, requires_network: false, dependencies: [], fallback: 'local', owner: 'veil-local', version: '0.1.0', tags: [] };
}

export function catalogManifest() {
    return {
        manifest_version: '3.0',
        product: 'VEIL',
        catalog_summary: { engines: '8', turbos: '9', live_turbos: '9', stubs: '0', mode: 'catalog', source: 'VEIL' },
        capabilities: [
            stableCapability('veil-browser-core', 'browser', 'browser'),
            stableCapability('veil-security-stack', 'security', 'policy'),
            stableCapability('veil-performance-stack', 'performance', 'performance-panel'),
            stableCapability('veil-privacy-stack', 'privacy', 'browser'),
            stableCapability('veil-downloads', 'browser', 'sidebar'),
            stableCapability('veil-bookmarks', 'browser', 'sidebar'),
            stableCapability('veil-history', 'browser', 'sidebar'),
            stableCapability('veil-settings', 'browser', 'settings'),
        ],
        engines: [],
        turbos: [],
    };
}

export function realVEILManifest() {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'veil-manifest.json'), 'utf8'));
}

export async function bootShell({ tauri = null, fetchImpl = null, skipModules = [] } = {}) {
    window.__TAURI__ = tauri || stubTauri();
    window.fetch = fetchImpl || (async () => ({
        ok: true,
        status: 200,
        json: async () => catalogManifest(),
    }));
    window.scrollTo = () => { };
    // Deterministic rAF: jsdom's ~16ms scheduling made rect-sync timing flaky.
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    // jsdom ships no AbortSignal.timeout; Resolute/protects fetches pass one.
    if (!globalThis.AbortSignal?.timeout) {
        globalThis.AbortSignal = globalThis.AbortSignal || function AbortSignal() { };
        globalThis.AbortSignal.timeout = () => new (globalThis.AbortController || class { constructor() { this.signal = { aborted: false }; } })().signal;
    }
    window.matchMedia = window.matchMedia || (() => ({ matches: false, media: '', addListener: () => { }, removeListener: () => { }, addEventListener: () => { }, removeEventListener: () => { } }));
    stubCanvas(document.getElementById('perf-canvas'));

    const MODULES = [
        './shell/tauri-api.js',
        './shell/settings-panel-render.js',
        './shell/managers-boot.js',
        './shell/fallback-manifest.js',
        './shell/manifest.js',
        './ui/density-core.js',
        './ui/density-core-b.js',
        './ui/density-surfaces.js',
        './ui/density-surfaces-b.js',
        './shell/bind-helpers.js',
        './shell/capabilities.js',
        './shell/chrome-actions.js',
        './shell/spotlight-context.js',
        './shell/spotlight-suggestions.js',
        './shell/spotlight-suggestions-b.js',
        './shell/sidebar-utils.js',
        './shell/surfaces-core.js',
        './shell/sidebar-render.js',
        './shell/bookmarks-bar.js',
        './shell/section-nav.js',
        './browser/tab-manager.js',
        './browser/tab-manager-extras.js',
        './shell/chrome-bindings.js',
        './shell/chrome-bindings-b.js',
        './shell/chrome-bindings-c.js',
    ];

    for (const mod of MODULES) {
        if (skipModules.includes(mod)) continue;
        await import(url.pathToFileURL(path.join(ROOT, 'src', mod)).href);
    }

    const runtime = window.veilRuntime;
    const manifest = await runtime.start({ getTabs: () => window.tabManager?.tabs || [] });
    runtime.manifest = manifest;
    runtime.capabilities = new Map((manifest.capabilities || []).map((capability) => [capability.id, capability]));
    window.veilManifest = manifest;

    return {
        tauri: window.__TAURI__,
        managers: {
            download: window.downloadManager,
            bookmark: window.bookmarkManager,
            settings: window.settingsManager,
            history: window.historyManager,
            session: window.sessionManager,
            recentlyClosed: window.recentlyClosedManager,
        },
        toast: window.toastManager,
        loading: window.loadingManager,
        tabManager: window.tabManager,
        perfMonitor: window.perfMonitor,
        runtime: window.veilRuntime,
    };
}

export function resetShellDom() {
    const html = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
    const bodyStart = html.indexOf('<body');
    const afterTag = html.indexOf('>', bodyStart) + 1;
    const bodyEnd = html.lastIndexOf('</body>');
    document.body.innerHTML = html.slice(afterTag, bodyEnd).replace(/<script[\s\S]*?<\/script>/g, '');
}

export function quietLogs() {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
}

export function restoreLogs() {
    jest.restoreAllMocks();
}
