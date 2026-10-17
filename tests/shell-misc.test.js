/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS™ — shell misc coverage (manifest, tauri-api, rnk-webviews,
 * protects-health, sidebar-utils, spotlight-context, eval-chunk)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import {
    bootShell,
    resetShellDom,
    resetModuleRegistry,
    quietLogs,
    restoreLogs,
    drainListeners,
    stubTauri,
    catalogManifest,
    ROOT,
} from './helpers/shell-harness.js';
import url from 'node:url';

const srcUrl = (rel) => url.pathToFileURL(`${ROOT}/src/${rel}`).href;

beforeEach(() => {
    resetShellDom();
    resetModuleRegistry();
    window.sessionStorage.clear();
    window.localStorage.clear();
    quietLogs();
});

afterEach(() => {
    drainListeners();
    restoreLogs();
});

describe('shell/eval-chunk', () => {
    test('evaluates chunk source into the global scope', async () => {
        const { evalChunk } = await import(srcUrl('shell/eval-chunk.js'));
        evalChunk('var __genysysProbe = 41 + 1;', 'probe');
        expect(window.__genysysProbe).toBe(42);
    });

    test('syntax errors are logged and rethrown', async () => {
        const { evalChunk } = await import(srcUrl('shell/eval-chunk.js'));
        expect(() => evalChunk(')))nope(((;', 'broken')).toThrow();
    });
});

describe('shell/manifest', () => {
    test('loadGENYSYSManifest caches the catalog response and fills the capability map', async () => {
        const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => catalogManifest() }));
        window.fetch = fetchMock;
        await import(srcUrl('shell/manifest.js'));
        const manifest = await window.loadGENYSYSManifest();
        expect(manifest.capabilities.length).toBe(8);
        expect(window.genysysRuntime.capabilities.get('genysys-settings')).toBeDefined();
        expect(window.genysysManifest.product).toBe('GENYSYS');
    });

    test('catalog failure falls back to FALLBACK_GENYSYS_MANIFEST with an empty map', async () => {
        window.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
        await import(srcUrl('shell/manifest.js'));
        const manifest = await window.loadGENYSYSManifest();
        expect(manifest).toBe(window.FALLBACK_GENYSYS_MANIFEST);
        expect(window.genysysRuntime.capabilities.size).toBe(0);
    });

    test('empty catalog falls back to the local manifest response', async () => {
        const fetchMock = jest.fn()
            .mockResolvedValueOnce({ ok: false, status: 404 })
            .mockResolvedValueOnce({ ok: false, status: 404 })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ engines: [{ id: 'browser-core' }] }),
            });
        window.fetch = fetchMock;
        await import(srcUrl('shell/manifest.js'));
        const manifest = await window.loadGENYSYSManifest();
        expect(manifest.engines).toHaveLength(1);
        expect(window.genysysRuntime.capabilities.size).toBe(0);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});

describe('shell/tauri-api', () => {
    test('global bridge with getCurrent exposes the current window', async () => {
        const current = { minimize: () => { }, label: 'main' };
        window.__TAURI__ = { invoke: async () => null, window: { getCurrent: () => current } };
        await import(srcUrl('shell/tauri-api.js'));
        expect(await window.initTauriAPI()).toBe(true);
        expect(window.appWindow).toBe(current);
    });

    test('global bridge falls back to the exposed appWindow when getCurrent is absent', async () => {
        const current = { label: 'main' };
        window.__TAURI__ = { invoke: async () => null, window: { appWindow: current } };
        await import(srcUrl('shell/tauri-api.js'));
        expect(await window.initTauriAPI()).toBe(true);
        expect(window.appWindow).toBe(current);
    });

    test('global bridge with no current window keeps IPC alive through command stubs', async () => {
        const tauri = stubTauri();
        window.__TAURI__ = { ...tauri, window: { getCurrent: () => null, appWindow: null } };
        await import(srcUrl('shell/tauri-api.js'));
        expect(await window.initTauriAPI()).toBe(true);
        await window.appWindow.unmaximize();
        await window.appWindow.close();
        expect(await window.appWindow.isMaximized()).toBe(false);
        expect(tauri.__invocations.map((i) => i.cmd)).toEqual(
            expect.arrayContaining(['window_maximize', 'window_close']),
        );
    });

    test('global bridge without a window module builds the command fallback', async () => {
        const tauri = stubTauri();
        window.__TAURI__ = tauri;
        await import(srcUrl('shell/tauri-api.js'));
        expect(await window.initTauriAPI()).toBe(true);
        expect(window.appWindow).not.toBeNull();
        await window.appWindow.minimize();
        await window.appWindow.maximize();
        await window.appWindow.unmaximize();
        expect(tauri.__invocations.map((i) => i.cmd)).toEqual(
            expect.arrayContaining(['window_minimize', 'window_maximize']),
        );
    });

    test('no bridge loads the real ESM package modules', async () => {
        delete window.__TAURI__;
        await import(srcUrl('shell/tauri-api.js'));
        expect(await window.initTauriAPI()).toBe(true);
        const tauriModule = await import('@tauri-apps/api/tauri');
        expect(window.invoke).toBe(tauriModule.invoke);
        expect(window.appWindow).toBeDefined();
    });

    test('package import failure falls back to logged stubs', async () => {
        jest.unstable_mockModule('@tauri-apps/api/window', () => {
            throw new Error('package unavailable in test');
        });
        delete window.__TAURI__;
        await import(srcUrl('shell/tauri-api.js'));
        expect(await window.initTauriAPI()).toBe(false);
        window.appWindow.minimize();
        window.appWindow.maximize();
        window.appWindow.unmaximize();
        window.close = jest.fn();
        window.appWindow.close();
        expect(await window.appWindow.isMaximized()).toBe(false);
        const result = await window.invoke('any_command', { a: 1 });
        expect(result).toEqual({ success: true });
    });
});

describe('shell/rnk-webviews', () => {
    test('privileged webview shell renders and the iframe fallback mounts Raven', async () => {
        delete window.__TAURI__;
        await bootShell();
        const { mountRnkWebview } = await import(srcUrl('shell/rnk-webviews.js'));
        mountRnkWebview('operations');
        const mount = document.getElementById('rnk-webview-operations');
        expect(mount.querySelector('.rnk-webview-url').textContent).toBe('https://raven.rnk-enterprise.us/dashboard');
        expect(mount.querySelector('iframe.rnk-webview').getAttribute('src')).toBe(
            'https://raven.rnk-enterprise.us/dashboard',
        );
        expect(mount.querySelector('#rnk-webview-note-operations').hidden).toBe(true);
    });

    test('Echonet comms target mounts over the previous frame', async () => {
        delete window.__TAURI__;
        await bootShell();
        const { mountRnkWebview } = await import(srcUrl('shell/rnk-webviews.js'));
        mountRnkWebview('comms');
        const mount = document.getElementById('rnk-webview-comms');
        expect(mount.querySelector('iframe.rnk-webview').getAttribute('src')).toBe(
            'https://echonet.rnk-enterprise.us/',
        );
    });

    test('each product section receives its own webview host id', async () => {
        delete window.__TAURI__;
        await bootShell();
        const { mountRnkWebview } = await import(srcUrl('shell/rnk-webviews.js'));
        mountRnkWebview('operations');
        mountRnkWebview('people');
        mountRnkWebview('comms');
        expect([...document.querySelectorAll('.rnk-webview-host')].map((host) => host.id)).toEqual([
            'rnk-webview-host-operations',
            'rnk-webview-host-people',
            'rnk-webview-host-comms',
        ]);
    });

    test('WebviewWindow construction failure surfaces the honest degraded note', async () => {
        jest.unstable_mockModule('@tauri-apps/api/window', () => ({
            WebviewWindow: class {
                constructor() { throw new Error('no shell'); }
            },
        }));
        await bootShell();
        window.__TAURI__ = { ...window.__TAURI__, window: { WebviewWindow: {} } };
        const { mountRnkWebview } = await import(srcUrl('shell/rnk-webviews.js'));
        mountRnkWebview('people');
        await new Promise((resolve) => setTimeout(resolve, 0));
        const note = document.querySelector('#rnk-webview-note-people');
        expect(note.hidden).toBe(false);
        expect(note.textContent).toContain('RNK product unreachable');
    });

    test('native shell opens a dedicated WebviewWindow when available', async () => {
        jest.unstable_mockModule('@tauri-apps/api/window', () => ({
            WebviewWindow: class {
                constructor(label, options) {
                    globalThis.__genysysNativeWebview = { label, options };
                }
            },
        }));
        await bootShell();
        window.__TAURI__ = { ...window.__TAURI__, window: { WebviewWindow: {} } };
        const { mountRnkWebview } = await import(srcUrl('shell/rnk-webviews.js'));
        mountRnkWebview('people');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(globalThis.__genysysNativeWebview).toEqual({
            label: 'genysys-Raven — People',
            options: expect.objectContaining({
                url: 'https://raven.rnk-enterprise.us/hr',
                title: 'GENYSYS — Raven — People',
            }),
        });
        expect(document.querySelector('#rnk-webview-note-people').hidden).toBe(true);
        delete globalThis.__genysysNativeWebview;
    });

    test('webview fallback reports DOM failures without pretending success', async () => {
        delete window.__TAURI__;
        await bootShell();
        const { mountRnkWebview } = await import(srcUrl('shell/rnk-webviews.js'));
        const createElement = document.createElement;
        document.createElement = () => { throw new Error('dom failure'); };
        try {
            mountRnkWebview('operations');
            await new Promise((resolve) => setTimeout(resolve, 0));
            const note = document.querySelector('#rnk-webview-note-operations');
            expect(note.hidden).toBe(false);
            expect(note.textContent).toContain('RNK product unreachable');
        } finally {
            document.createElement = createElement;
        }
    });

    test('webview fallback reports a missing host without throwing', async () => {
        delete window.__TAURI__;
        await bootShell();
        const { mountRnkWebview } = await import(srcUrl('shell/rnk-webviews.js'));
        const mount = document.getElementById('rnk-webview-operations');
        const querySelector = mount.querySelector.bind(mount);
        mount.querySelector = (selector) => (
            selector === '#rnk-webview-host-operations' ? null : querySelector(selector)
        );
        mountRnkWebview('operations');
        await new Promise((resolve) => setTimeout(resolve, 0));
        const note = querySelector('#rnk-webview-note-operations');
        expect(note.hidden).toBe(false);
        expect(note.textContent).toContain('RNK product unreachable');
    });

    test('webview open tolerates a missing status note', async () => {
        delete window.__TAURI__;
        await bootShell();
        const { mountRnkWebview } = await import(srcUrl('shell/rnk-webviews.js'));
        const mount = document.getElementById('rnk-webview-operations');
        const querySelector = mount.querySelector.bind(mount);
        mount.querySelector = (selector) => (
            selector === '#rnk-webview-note-operations' ? null : querySelector(selector)
        );
        mountRnkWebview('operations');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(querySelector('#rnk-webview-host-operations iframe')).not.toBeNull();
    });

    test('unknown section and missing mount are no-ops', async () => {
        delete window.__TAURI__;
        await bootShell();
        const { mountRnkWebview } = await import(srcUrl('shell/rnk-webviews.js'));
        expect(() => mountRnkWebview('does-not-exist')).not.toThrow();
        const unknownMount = document.createElement('div');
        unknownMount.id = 'rnk-webview-does-not-exist';
        document.body.appendChild(unknownMount);
        expect(() => mountRnkWebview('does-not-exist')).not.toThrow();
        expect(unknownMount.innerHTML).toBe('');
        const originalGetElementById = document.getElementById.bind(document);
        const syntheticMount = document.createElement('div');
        document.getElementById = (id) => (
            id === 'rnk-webview-synthetic' ? syntheticMount : originalGetElementById(id)
        );
        try {
            expect(() => mountRnkWebview('synthetic')).not.toThrow();
            expect(syntheticMount.innerHTML).toBe('');
        } finally {
            document.getElementById = originalGetElementById;
        }
        expect(() => mountRnkWebview('operations')).not.toThrow();
    });
});

describe('protection/protects-health', () => {
    test('organ health renders reachable states and saves the URL override', async () => {
        delete window.__TAURI__;
        await bootShell();
        window.fetch = async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                connected: true,
                organs: {
                    resolute: 'ARMED', policyEngine: 'ENGAGED', attestation: 'VALID',
                    chainRouting: 'inactive', heartbeat: 'BEATING',
                },
            }),
        });
        const { mountProtectsHealth } = await import(srcUrl('protection/protects-health.js'));
        const mount = document.createElement('div');
        document.body.appendChild(mount);
        mountProtectsHealth(mount);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(mount.innerHTML).toContain('REACHABLE');
        expect(mount.innerHTML).toContain('ARMED');
        expect(mount.innerHTML).toContain('UNKNOWN');

        document.getElementById('protects-url-input').value = 'http://127.0.0.1:9000/';
        document.getElementById('protects-url-save').click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(localStorage.getItem('genysys_resolute_url')).toBe('http://127.0.0.1:9000/');
    });

    test('dark Resolute renders the fail-closed gate and empty input is ignored', async () => {
        delete window.__TAURI__;
        await bootShell();
        window.fetch = async () => { throw new Error('dark'); };
        const { mountProtectsHealth } = await import(srcUrl('protection/protects-health.js'));
        const mount = document.createElement('div');
        document.body.appendChild(mount);
        mountProtectsHealth(mount);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(mount.innerHTML).toContain('HOLD — FAIL CLOSED');

        document.getElementById('protects-url-input').value = '';
        document.getElementById('protects-url-save').click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(localStorage.getItem('genysys_resolute_url')).toBeNull();
    });

    test('missing mount element is a no-op', async () => {
        delete window.__TAURI__;
        await bootShell();
        const { mountProtectsHealth } = await import(srcUrl('protection/protects-health.js'));
        expect(() => mountProtectsHealth(null)).not.toThrow();
    });
});

describe('shell/sidebar-utils', () => {
    test('escapeHtml encodes every dangerous entity', async () => {
        await bootShell();
        expect(window.escapeHtml('<a href="x">&\'</a>')).toBe(
            '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
        );
    });

    test('highlightSidebarMatch marks matches and passes through safely', async () => {
        await bootShell();
        expect(window.highlightSidebarMatch('RNK Enterprise', 'rnk')).toBe('<mark>RNK</mark> Enterprise');
        expect(window.highlightSidebarMatch('plain', '')).toBe('plain');
        expect(window.highlightSidebarMatch('a.b(c)', 'a.b(')).toBe('<mark>a.b(</mark>c)');
        expect(window.highlightSidebarMatch('untouched', null)).toBe('untouched');
    });
});

describe('shell/spotlight-context', () => {
    test('every context class is classified', async () => {
        await bootShell();
        const ctx = window.getGENYSYSSpotlightContext;
        expect(ctx('github.com', 'repo', 'https://github.com/rnk/genysys/pull/1')).toBe('dev');
        expect(ctx('github.com', 'repository hub', '')).toBe('code');
        expect(ctx('docs.rust', 'guide', '')).toBe('docs');
        expect(ctx('', 'The AI assistant', '')).toBe('ai');
        expect(ctx('news.ycombinator', '', '')).toBe('news');
        expect(ctx('linear.app', '', '')).toBe('workspace');
        expect(ctx('', 'automation workflow', '')).toBe('automation');
        expect(ctx('slack.com', '', '')).toBe('comms');
        expect(ctx('127.0.0.1', '', '')).toBe('dev');
        expect(ctx('youtube.com', '', '')).toBe('media');
        expect(ctx('addons.mozilla', '', '')).toBe('extensions');
        expect(ctx('mirror', 'installer', 'https://mirror/x.zip')).toBe('downloads');
        expect(ctx('duckduckgo.com', '', '')).toBe('search');
        expect(ctx('example.com', 'page', 'https://example.com/')).toBe('general');
    });
});
