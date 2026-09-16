/**
 * @jest-environment jsdom
 */

/**
 * VEIL™ — main.js orchestrator coverage
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
    realVEILManifest,
    ROOT,
} from './helpers/shell-harness.js';
import url from 'node:url';

const mainUrl = () => url.pathToFileURL(`${ROOT}/src/main.js`).href;

beforeEach(() => {
    resetShellDom();
    resetModuleRegistry();
    window.sessionStorage.clear();
    window.localStorage.clear();
    quietLogs();
});

afterEach(() => {
    try { window.veilRuntime?.stop?.(); } catch { /* already gone */ }
    drainListeners();
    restoreLogs();
});

function primeBridge(overrides = {}) {
    const tauri = stubTauri(overrides);
    window.__TAURI__ = tauri;
    const manifest = realVEILManifest();
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
    if (!window.__veilBooted) {
        document.dispatchEvent(new CustomEvent('veil:authenticated', { detail: { name: 'Odinn' } }));
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
}

describe('main.js initializeApp', () => {
    test('gate visible: boot waits for the veil:authenticated event', async () => {
        const tauri = primeBridge();
        await import(mainUrl());
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.__veilBooted).toBeUndefined();
        expect(tauri.__invocations.map((i) => i.cmd)).not.toContain('set_session');

        document.dispatchEvent(new CustomEvent('veil:authenticated', { detail: { name: 'Odinn' } }));
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.__veilBooted).toBe(true);
        expect(window.tabManager.tabs.length).toBe(1);
    });

    test('boot restores tabs, renders the turbo panel, and reports status', async () => {
        primeBridge();
        document.body.insertAdjacentHTML('beforeend', '<div id="perf-turbo-list"></div>');
        window.localStorage.setItem('rnk-veil-tabs', JSON.stringify({
            tabs: [{ url: 'https://odinn.rnk-enterprise.us/', title: 'RNK', favicon: '', pinned: true }],
            activeIndex: 0,
        }));
        await bootMain();

        expect(window.tabManager.tabs.length).toBe(1);
        expect(window.tabManager.tabs[0].pinned).toBe(true);
        expect(window.veilRuntime.manifest.capabilities.length).toBe(17);
        expect(window.veilManifest.capabilities.length).toBe(17);
        expect(document.getElementById('perf-summary-text').textContent).toContain('live turbos');
        expect(document.querySelectorAll('#perf-turbo-list input[data-turbo-id]').length).toBe(9);
        expect(document.getElementById('status-text').textContent).toContain('Viewing');
        expect(document.querySelector('[id*="lisa"]')).toBeTruthy();
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
        expect(window.veilRuntime.enabled[toggled]).toBe(false);
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(window.veilRuntime.enabled[toggled]).toBe(true);
    });

    test('re-entry guard: importing main.js twice never double-restores', async () => {
        primeBridge();
        await bootMain();
        expect(window.tabManager.tabs.length).toBe(1);
        await import(mainUrl());
        document.dispatchEvent(new CustomEvent('veil:authenticated', { detail: {} }));
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.tabManager.tabs.length).toBe(1);
    });

    test('shell density presets re-apply through the compact branch', async () => {
        primeBridge();
        await import(mainUrl());
        window.shellDensityState = 'compact';
        document.dispatchEvent(new CustomEvent('veil:authenticated', { detail: {} }));
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.settingsPanelDensityState).toBe('compact');
        expect(window.statusbarDensityState).toBe('compact');
    });

    test('session-seeded pages boot immediately at module eval', async () => {
        primeBridge();
        window.sessionStorage.setItem('rnk-veil-auth-session', JSON.stringify({ token: 't', expires: Date.now() + 60000 }));
        document.body.insertAdjacentHTML('beforeend', '<div id="perf-turbo-list"></div>');
        await import(mainUrl());
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.__veilBooted).toBe(true);
        expect(window.tabManager.tabs.length).toBe(1);
    });

    test('engine runtime failure surfaces through the boot catch and console.error', async () => {
        primeBridge();
        await import(mainUrl());
        const errorSpy = jest.spyOn(console, 'error');
        errorSpy.mockClear();
        const originalStart = window.veilRuntime.start.bind(window.veilRuntime);
        window.veilRuntime.start = async () => { throw new Error('catalog dark'); };
        try {
            document.dispatchEvent(new CustomEvent('veil:authenticated', { detail: {} }));
            await new Promise((resolve) => setTimeout(resolve, 30));
            expect(errorSpy).toHaveBeenCalledWith('VEIL initializeApp failed:', expect.any(Error));
        } finally {
            window.veilRuntime.start = originalStart;
        }
    });
});

describe('main.js welcome-tour linkage', () => {
    test('boot imports the welcome system without a stored profile', async () => {
        primeBridge();
        await bootMain();
        expect(document.getElementById('veil-tour-overlay')).not.toBeNull();
        expect(document.getElementById('veil-daily-message')).toBeNull();
    });
});
