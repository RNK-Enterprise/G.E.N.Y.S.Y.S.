/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS™ — main.js orchestrator coverage
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import {
    resetShellDom,
    resetModuleRegistry,
    quietLogs,
    restoreLogs,
    drainListeners,
    stubTauri,
    stubCanvas,
    realGENYSYSManifest,
    ROOT,
} from './helpers/shell-harness.js';
import url from 'node:url';

const mainUrl = (suffix = '') => `${url.pathToFileURL(`${ROOT}/src/main.js`).href}${suffix}`;

beforeEach(() => {
    resetShellDom();
    resetModuleRegistry();
    window.sessionStorage.clear();
    window.localStorage.clear();
    quietLogs();
});

afterEach(() => {
    try { window.genysysRuntime?.stop?.(); } catch { /* already gone */ }
    drainListeners();
    restoreLogs();
});

function primeBridge(overrides = {}) {
    const tauri = stubTauri(overrides);
    window.__TAURI__ = tauri;
    const manifest = realGENYSYSManifest();
    window.fetch = async () => ({ ok: true, status: 200, json: async () => manifest });
    window.scrollTo = () => { };
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    window.matchMedia = window.matchMedia || (() => ({ matches: false, media: '', addListener: () => { }, removeListener: () => { }, addEventListener: () => { }, removeEventListener: () => { } }));
    stubCanvas(document.getElementById('perf-canvas'));
    return tauri;
}

async function bootMain() {
    await import(mainUrl());
    if (!window.__genysysBooted) {
        document.dispatchEvent(new CustomEvent('genysys:authenticated', { detail: { name: 'Odinn' } }));
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
}

describe('main.js initializeApp', () => {
    test('gate visible: boot waits for the genysys:authenticated event', async () => {
        const tauri = primeBridge();
        await import(mainUrl());
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.__genysysBooted).toBeUndefined();
        expect(tauri.__invocations.map((i) => i.cmd)).not.toContain('set_session');

        document.dispatchEvent(new CustomEvent('genysys:authenticated', { detail: { name: 'Odinn' } }));
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.__genysysBooted).toBe(true);
        expect(window.tabManager.tabs.length).toBe(1);
    });

    test('boot restores tabs, renders the turbo panel, and reports status', async () => {
        primeBridge();
        document.body.insertAdjacentHTML('beforeend', '<div id="perf-turbo-list"></div>');
        window.localStorage.setItem('rnk-genysys-tabs', JSON.stringify({
            tabs: [{ url: 'https://odinn.rnk-enterprise.us/', title: 'RNK', favicon: '', pinned: true }],
            activeIndex: 0,
        }));
        await bootMain();

        expect(window.tabManager.tabs.length).toBe(1);
        expect(window.tabManager.tabs[0].pinned).toBe(true);
        expect(window.genysysRuntime.manifest.capabilities.length).toBe(17);
        expect(window.genysysManifest.capabilities.length).toBe(17);
        expect(document.getElementById('perf-summary-text').textContent).toContain('live turbos');
        expect(document.querySelectorAll('#perf-turbo-list input[data-turbo-id]').length).toBe(9);
        expect(document.getElementById('status-text').textContent).toContain('Viewing');
        expect(document.querySelector('[id*="policy"]')).toBeTruthy();
    });

    test('no saved session creates the initial newtab and the turbo toggles re-arm', async () => {
        primeBridge();
        document.body.insertAdjacentHTML('beforeend', '<div id="perf-turbo-list"></div>');
        await bootMain();

        expect(window.tabManager.tabs.length).toBe(1);
        const input = document.querySelector('#perf-turbo-list input[data-turbo-id]');
        const toggled = input.getAttribute('data-turbo-id');
        expect(toggled).toMatch(/^turbo-/);
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(window.genysysRuntime.enabled[toggled]).toBe(false);
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(window.genysysRuntime.enabled[toggled]).toBe(true);
    });

    test('re-entry guard: importing main.js twice never double-restores', async () => {
        primeBridge();
        await bootMain();
        expect(window.tabManager.tabs.length).toBe(1);
        await import(mainUrl('?reentry'));
        document.dispatchEvent(new CustomEvent('genysys:authenticated', { detail: {} }));
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.tabManager.tabs.length).toBe(1);
    });

    test('re-entry guard returns on a duplicate authenticated event', async () => {
        primeBridge();
        await import(mainUrl('?guard-only'));
        window.__genysysBooted = true;
        document.dispatchEvent(new CustomEvent('genysys:authenticated', { detail: {} }));
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.__genysysBooted).toBe(true);
    });

    test('sparse manifest and absent optional surfaces fail safely', async () => {
        primeBridge();
        await import(mainUrl('?sparse'));
        const runtime = window.genysysRuntime;
        runtime.start = async ({ getTabs }) => {
            expect(getTabs()).toEqual([]);
            return { catalog_summary: {} };
        };
        window.__TAURI__ = {};
        delete window.genysysRuntime;
        delete window.tabManager;
        document.getElementById('perf-turbo-list')?.remove();
        document.getElementById('perf-summary-text')?.remove();
        [
            'renderGENYSYSCapabilities',
            'renderBookmarksBar',
            'updateSettingsSectionAvailability',
            'updateGENYSYSSurfaceAvailability',
            'loadSettings',
            'setShellDensityState',
            'applyTabBarCompactState',
            'applyOmniboxCompactState',
            'applySettingsDenseState',
            'applyStatusbarMinimalState',
            'applyTitlebarCompactState',
            'applyDensityDependentSurfaces',
            'syncShellDensityStateFromSurfaces',
            'applyGENYSYSRuntimeStatus',
            'updateStatusBar',
        ].forEach((name) => delete window[name]);

        document.dispatchEvent(new CustomEvent('genysys:authenticated'));
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.__genysysBooted).toBe(true);
        expect(console.error).toHaveBeenCalledWith('GENYSYS initializeApp failed:', expect.any(Error));
    });

    test('turbo panel renders disabled rows and swallows boot-log rejection', async () => {
        const tauri = primeBridge();
        const invoke = tauri.invoke;
        tauri.invoke = (command, args) => command === 'log_boot'
            ? Promise.reject(new Error('diagnostic unavailable'))
            : invoke(command, args);
        await import(mainUrl('?turbo-fallback'));
        const runtime = window.genysysRuntime;
        runtime.start = async () => ({ capabilities: [], catalog_summary: {} });
        runtime.listTurboStates = () => [{ id: 'turbo-off', name: 'Off', enabled: false, status: 'idle' }];
        document.body.insertAdjacentHTML('beforeend', '<div id="perf-turbo-list"></div>');
        document.dispatchEvent(new CustomEvent('genysys:authenticated', { detail: {} }));
        await new Promise((resolve) => setTimeout(resolve, 30));

        const input = document.querySelector('#perf-turbo-list input[data-turbo-id="turbo-off"]');
        expect(input).not.toBeNull();
        expect(input.checked).toBe(false);
        expect(document.getElementById('perf-turbo-list').textContent).toContain('0 turbos in catalog');
    });

    test('loading document waits for DOMContentLoaded before booting', async () => {
        primeBridge();
        const original = Object.getOwnPropertyDescriptor(document, 'readyState');
        Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
        try {
            await import(mainUrl('?loading'));
            expect(window.__genysysBooted).toBeUndefined();
            Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
            document.dispatchEvent(new Event('DOMContentLoaded'));
            document.dispatchEvent(new CustomEvent('genysys:authenticated', { detail: { name: 'Odinn' } }));
            await new Promise((resolve) => setTimeout(resolve, 30));
            expect(window.__genysysBooted).toBe(true);
        } finally {
            if (original) Object.defineProperty(document, 'readyState', original);
        }
    });

    test('shell density presets re-apply through the compact branch', async () => {
        primeBridge();
        await import(mainUrl());
        window.shellDensityState = 'compact';
        document.dispatchEvent(new CustomEvent('genysys:authenticated', { detail: {} }));
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.settingsPanelDensityState).toBe('compact');
        expect(window.statusbarDensityState).toBe('compact');
    });

    test('session-seeded pages boot immediately at module eval', async () => {
        primeBridge();
        window.sessionStorage.setItem('rnk-genysys-auth-session', JSON.stringify({ token: 't', expires: Date.now() + 60000 }));
        document.body.insertAdjacentHTML('beforeend', '<div id="perf-turbo-list"></div>');
        await import(mainUrl());
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.__genysysBooted).toBe(true);
        expect(window.tabManager.tabs.length).toBe(1);
    });

    test('engine runtime failure surfaces through the boot catch and console.error', async () => {
        primeBridge();
        await import(mainUrl());
        const errorSpy = jest.spyOn(console, 'error');
        errorSpy.mockClear();
        const originalStart = window.genysysRuntime.start.bind(window.genysysRuntime);
        window.genysysRuntime.start = async () => { throw new Error('catalog dark'); };
        try {
            document.dispatchEvent(new CustomEvent('genysys:authenticated', { detail: {} }));
            await new Promise((resolve) => setTimeout(resolve, 30));
            expect(errorSpy).toHaveBeenCalledWith('GENYSYS initializeApp failed:', expect.any(Error));
        } finally {
            window.genysysRuntime.start = originalStart;
        }
    });
});

describe('main.js welcome-tour linkage', () => {
    test('boot imports the welcome system without a stored profile', async () => {
        primeBridge();
        await bootMain();
        expect(document.getElementById('genysys-tour-overlay')).not.toBeNull();
        expect(document.getElementById('genysys-daily-message')).toBeNull();
    });
});
