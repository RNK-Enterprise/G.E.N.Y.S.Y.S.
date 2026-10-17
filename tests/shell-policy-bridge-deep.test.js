/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS™ — deep POLICY bridge and auth UI coverage
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import {
    bootShell,
    resetShellDom,
    resetModuleRegistry,
    quietLogs,
    drainListeners,
    stubTauri,
} from './helpers/shell-harness.js';

function stopRuntime() {
    try { window.genysysRuntime?.stop(); } catch { /* not started */ }
}

beforeEach(() => {
    stopRuntime();
    resetShellDom();
    resetModuleRegistry();
    localStorage.clear();
    window.sessionStorage.clear();
    globalThis.__GENYSYS_DEV__ = false;
    quietLogs();
    drainListeners();
});

describe('shell: POLICY bridge fallback and session edges', () => {
    test('browser fallback covers internal, session, health, access, and tab commands', async () => {
        globalThis.__GENYSYS_DEV__ = true;
        await bootShell();
        const bridge = await import('../src/policy-bridge.js');
        window.__TAURI__ = undefined;

        const internal = await bridge.tauriInvoke('navigate_tab', { url: 'genysys://newtab' });
        expect(internal.decision).toBe('allow');
        expect(internal.reason).toBe('internal_genysys_surface');
        expect((await bridge.tauriInvoke('navigate_tab', {})).decision).toBe('block');
        expect((await bridge.tauriInvoke('create_tab', {})).url).toBe('genysys://newtab');
        expect((await bridge.tauriInvoke('create_tab', { url: 'https://custom.test/' })).url).toBe('https://custom.test/');
        expect(await bridge.tauriInvoke('set_session', {})).toBeNull();
        expect(await bridge.tauriInvoke('get_session_info', {})).toMatchObject({ accessTier: 'locked' });
        expect(await bridge.tauriInvoke('auth_session_info', {})).toMatchObject({ authenticated: false });
        expect(await bridge.tauriInvoke('check_policy_health', {})).toMatchObject({ connected: true });
        expect(await bridge.tauriInvoke('check_genysys_health', {})).toMatchObject({ localPolicy: true });
        expect(await bridge.tauriInvoke('request_site_access', { domain: 'example.test' })).toMatchObject({ submitted: true });

        const storageGet = jest.spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => { throw new Error('storage unavailable'); });
        globalThis.__GENYSYS_DEV__ = true;
        const blocked = await bridge.tauriInvoke('navigate_tab', { url: 'https://blocked.test/' });
        expect(blocked.reason).toBe('policy_unreachable_fail_closed');
        globalThis.__GENYSYS_DEV__ = false;
        storageGet.mockRestore();
    });

    test('browser fallback bypass covers authentication and external navigation', async () => {
        globalThis.__GENYSYS_DEV__ = true;
        localStorage.setItem('genysys_dev_bypass', 'true');
        await bootShell();
        const bridge = await import('../src/policy-bridge.js');
        window.__TAURI__ = undefined;

        expect(await bridge.tauriInvoke('auth_resolve_code', { code: 'dev-code' }))
            .toMatchObject({ token: 'dev-bypass', tier: 'dev' });
        expect(await bridge.tauriInvoke('navigate_tab', { url: 'https://bypass.test/' }))
            .toMatchObject({ decision: 'allow', reason: 'dev_bypass_allow' });
    });

    test('session failures and status fallback paths remain non-fatal', async () => {
        await bootShell();
        const bridge = await import('../src/policy-bridge.js');
        const indicator = document.createElement('span');
        indicator.id = 'policy-status-indicator';
        document.body.appendChild(indicator);

        window.__TAURI__ = stubTauri({
            invoke: async (command) => {
                if (command === 'get_session_info' || command === 'set_session' || command === 'clear_session') {
                    throw new Error('ipc down');
                }
                return null;
            },
        });
        await bridge.refreshSession();
        await bridge.setSession({ accessTier: 'agent' });
        await bridge.clearSession();
        bridge.updatePolicyStatusIndicator();
        expect(indicator.textContent).toBe('G.E.N.E.S.Y.S.: unauthenticated');

        window.__TAURI__ = stubTauri({
            invoke: async (command) => command === 'get_session_info'
                ? { authenticated: false }
                : null,
        });
        await bridge.refreshSession();
        expect(indicator.textContent).toBe('G.E.N.E.S.Y.S.: unauthenticated');
        expect(indicator.className).toContain('inactive');
    });
});

describe('shell: POLICY navigation and listener edges', () => {
    test('navigation handles missing decisions, internal URLs, optional callbacks, and flag timeout', async () => {
        await bootShell();
        const bridge = await import('../src/policy-bridge.js');
        const loading = [];
        window.addEventListener('genysys:tab-loading', (event) => loading.push(event.detail.loading));

        window.__TAURI__ = stubTauri({
            invoke: async (command) => command === 'navigate_tab' ? {} : null,
        });
        const missing = await bridge.navigateWithPolicy(3, 'genysys://missing', undefined, undefined);
        expect(missing.decision).toBeUndefined();
        expect(loading).toEqual([true, false]);

        jest.useFakeTimers();
        window.__TAURI__ = stubTauri({
            invoke: async (command) => command === 'navigate_tab' ? { decision: 'flag' } : null,
        });
        const flagged = await bridge.navigateWithPolicy(4, 'https://flagged.test/', undefined, undefined);
        expect(flagged.decision).toBe('flag');
        expect(document.getElementById('status-text').textContent).toContain('low confidence signal');
        jest.advanceTimersByTime(5000);
        expect(document.getElementById('status-text').textContent).toBe('Ready');
        document.getElementById('status-text').remove();
        window.__TAURI__ = stubTauri({
            invoke: async (command) => command === 'navigate_tab' ? { decision: 'flag' } : null,
        });
        await bridge.navigateWithPolicy(5, 'https://no-status.test/', undefined, undefined);
        jest.useRealTimers();
    });

    test('event listeners tolerate absent Tauri and absent managers', async () => {
        await bootShell();
        const bridge = await import('../src/policy-bridge.js');
        window.__TAURI__ = {};
        const unlisten = await bridge.onGENYSYSNavigate(null);
        expect(typeof unlisten).toBe('function');
        unlisten();
        bridge.initMessageListener(null);
        window.dispatchEvent(new MessageEvent('message', {
            data: { type: 'genysys:proceed-anyway', domain: 'no-manager.test' },
        }));

        const failingTauri = stubTauri({
            invoke: async (command) => {
                if (command === 'request_site_access') throw new Error('request rejected');
                if (command === 'get_session_info') return { authenticated: false };
                return null;
            },
        });
        window.__TAURI__ = failingTauri;
        const request = bridge.initMessageListener(null);
        window.dispatchEvent(new MessageEvent('message', {
            data: { type: 'genysys:access-request', domain: 'request.test', reason: 'test' },
        }));
        await request;
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

    test('bridge initialization covers missing payloads, null active tabs, and missing titlebar', async () => {
        await bootShell();
        const bridge = await import('../src/policy-bridge.js');
        document.querySelector('.titlebar-right').remove();
        const tauri = stubTauri({
            invoke: async (command) => {
                if (command === 'tab_window_hide_all' || command === 'tab_window_activate') {
                    throw new Error('window bridge unavailable');
                }
                return null;
            },
        });
        window.__TAURI__ = tauri;
        const manager = { activeTabId: 7, syncContentRect: jest.fn(), onTabMeta: jest.fn() };
        await bridge.initPolicyBridge(manager);
        tauri.__emit('genysys:navigate', undefined);
        tauri.__emit('genysys:tab-meta', undefined);
        tauri.__emit('genysys:tab-meta', { tabId: 2 });
        window.dispatchEvent(new CustomEvent('genysys:tab-loading', { detail: { tabId: 1, loading: true } }));
        window.dispatchEvent(new Event('resize'));
        window.tabWindowBridge.onSectionEnter();
        window.tabWindowBridge.onSectionLeave();
        manager.activeTabId = null;
        window.tabWindowBridge.onSectionEnter();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(document.getElementById('policy-status-indicator')).toBeNull();
    });

    test('status indicator opens auth panel for unauthenticated sessions', async () => {
        await bootShell();
        const bridge = await import('../src/policy-bridge.js');
        const tauri = stubTauri({
            invoke: async (command) => command === 'get_session_info'
                ? { accessTier: undefined, authenticated: false }
                : null,
        });
        window.__TAURI__ = tauri;
        await bridge.initPolicyBridge(window.tabManager);
        const indicator = document.getElementById('policy-status-indicator');
        expect(indicator.textContent).toBe('G.E.N.E.S.Y.S.: unauthenticated');
        indicator.click();
        expect(document.getElementById('genysys-auth-panel')).not.toBeNull();
        expect(tauri.__invocations.map((entry) => entry.cmd)).toContain('get_session_info');
    });
});

describe('shell: POLICY auth panel edge paths', () => {
    test('auth UI covers no-op hide, Enter submission, default error, and null-error failure', async () => {
        await bootShell();
        const bridge = await import('../src/policy-bridge.js');
        const auth = await import('../src/protection/access-auth-ui.js');
        auth.hideAuthPanel();
        auth.initAuthPanel();
        const panel = document.getElementById('genysys-auth-panel');
        const input = panel.querySelector('#genysys-shortcode-input');

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        window.__TAURI__ = stubTauri({
            invoke: async (command) => {
                if (command === 'auth_resolve_code') return {};
                return null;
            },
        });
        input.value = 'bad';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(panel.querySelector('#genysys-auth-error').textContent).toBe('Invalid access code');

        window.__TAURI__ = stubTauri({
            invoke: async (command) => {
                if (command === 'auth_resolve_code') return { token: 'unexpected-success' };
                return null;
            },
        });
        input.value = 'throws';
        const panelStyle = panel.style;
        Object.defineProperty(panel, 'style', {
            configurable: true,
            get: () => { throw new Error('style unavailable'); },
        });
        panel.querySelector('#genysys-auth-submit').click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(panel.querySelector('#genysys-auth-error').textContent)
            .toBe('Authentication error. GENYSYS native shell required.');

        Object.defineProperty(panel, 'style', { configurable: true, value: panelStyle });
        window.__TAURI__ = stubTauri({
            invoke: async (command) => {
                if (command === 'auth_resolve_code') throw null;
                return null;
            },
        });
        input.value = 'null-error';
        panel.querySelector('#genysys-auth-submit').click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(panel.querySelector('#genysys-auth-error').textContent).toBe('Invalid access code');
        expect(bridge.getSession()).toBeDefined();
    });

    test('auth success defaults missing tier and agent identity', async () => {
        await bootShell();
        const auth = await import('../src/protection/access-auth-ui.js');
        auth.initAuthPanel();
        const panel = document.getElementById('genysys-auth-panel');
        const input = panel.querySelector('#genysys-shortcode-input');
        const calls = [];
        window.__TAURI__ = stubTauri({
            invoke: async (command, args) => {
                calls.push({ command, args });
                if (command === 'auth_resolve_code') return { token: 'token-only' };
                return null;
            },
        });
        input.value = 'short-code';
        panel.querySelector('#genysys-auth-submit').click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const sessionCall = calls.find((call) => call.command === 'set_session');
        expect(sessionCall.args).toMatchObject({
            accessTier: 'agent',
            userId: null,
            sessionToken: 'token-only',
            shortcode: 'short-code',
        });
        expect(panel.style.display).toBe('none');
    });
});
