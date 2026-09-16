/**
 * @jest-environment jsdom
 */

/**
 * VEIL™ — LISA bridge coverage
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
    try { window.veilRuntime?.stop(); } catch { /* not started */ }
}

beforeEach(() => {
    stopRuntime();
    resetShellDom();
    resetModuleRegistry();
    localStorage.clear();
    window.sessionStorage.clear();
    quietLogs();
    drainListeners();
});

describe('lisa-bridge', () => {
    test('normalizeUrl covers domains, queries, internal schemes, and garbage', async () => {
        await bootShell();
        expect(window.normalizeUrl('https://ok.test/a')).toBe('https://ok.test/a');
        expect(window.normalizeUrl('veil://newtab')).toBe('veil://newtab');
        expect(window.normalizeUrl('example.com')).toBe('https://example.com');
        expect(window.normalizeUrl('best browser')).toBe('https://duckduckgo.com/?q=best%20browser');
        expect(window.normalizeUrl('')).toBe('veil://newtab');
        expect(window.normalizeUrl(null)).toBe('veil://newtab');
        expect(window.normalizeUrl('   ')).toBe('veil://newtab');
    });

    test('navigateWithLISA allow/flag paths dispatch policy-allow', async () => {
        const tauri = stubTauri({ invoke: (cmd, args) => (cmd === 'navigate_tab' ? { decision: 'flag', reason: 'low', domain: args.url } : null) });
        await bootShell({ tauri });
        const { navigateWithLISA } = await import('../src/lisa-bridge.js');
        const events = [];
        window.addEventListener('veil:policy-allow', (e) => events.push(e.detail.url));
        let allowed = 0;
        const policy = await navigateWithLISA(1, 'https://flag.test/', () => allowed++, () => { });
        expect(policy.decision).toBe('flag');
        expect(allowed).toBe(1);
        expect(events).toEqual(['https://flag.test/']);
        expect(document.getElementById('status-text').textContent).toContain('LISA flagged');
    });

    test('navigateWithLISA block/quarantine/chain/unknown fail closed', async () => {
        await bootShell();
        const { navigateWithLISA } = await import('../src/lisa-bridge.js');
        const decisions = ['block', 'quarantine', 'chain', 'mystery'];
        for (const decision of decisions) {
            window.__TAURI__ = stubTauri({ invoke: (cmd) => (cmd === 'navigate_tab' ? { decision } : null) });
            let blocked = 0;
            const policy = await navigateWithLISA(1, 'https://x.test/', () => { }, () => blocked++);
            expect(blocked).toBe(1);
            if (decision === 'quarantine') expect(policy.quarantined).toBe(true);
        }
    });

    test('navigateWithLISA fail-closed when the bridge throws or returns garbage', async () => {
        await bootShell();
        const { navigateWithLISA } = await import('../src/lisa-bridge.js');

        window.__TAURI__ = stubTauri({ invoke: async () => { throw new Error('dark'); } });
        let blocked = 0;
        const policy = await navigateWithLISA(1, 'https://dark.test/', () => { }, () => blocked++);
        expect(policy.decision).toBe('block');
        expect(policy.reason).toBe('lisa_unreachable_fail_closed');
        expect(blocked).toBe(1);

        window.__TAURI__ = stubTauri({ invoke: async () => null });
        let blocked2 = 0;
        const policy2 = await navigateWithLISA(1, 'https://void.test/', () => { }, () => blocked2++);
        expect(policy2.reason).toBe('missing_policy_fail_closed');
        expect(blocked2).toBe(1);
    });

    test('tauriInvoke dev fallback blocks without bypass', async () => {
        await bootShell();
        const { tauriInvoke } = await import('../src/lisa-bridge.js');
        window.__TAURI__ = undefined;
        const result = await tauriInvoke('navigate_tab', { url: 'https://dev.test/' });
        expect(result.decision).toBe('block');
        expect(result.reason).toBe('lisa_unreachable_fail_closed');
        expect(await tauriInvoke('unknown_command', {})).toBeNull();
        await expect(tauriInvoke('auth_resolve_code', { code: 'x' })).rejects.toThrow('Auth requires VEIL native shell');
    });

    test('tauriInvoke dev bypass allows when DEV and flag are set', async () => {
        globalThis.__VEIL_DEV__ = true;
        localStorage.setItem('veil_dev_bypass', 'true');
        await bootShell();
        const { tauriInvoke } = await import('../src/lisa-bridge.js');
        window.__TAURI__ = undefined;
        const bypassed = await tauriInvoke('navigate_tab', { url: 'https://dev.test/' });
        expect(bypassed.decision).toBe('allow');
        expect(bypassed.reason).toBe('dev_bypass_allow');
        await expect(tauriInvoke('auth_resolve_code', { code: 'x' })).resolves.toMatchObject({ tier: 'dev' });
        localStorage.removeItem('veil_dev_bypass');
        globalThis.__VEIL_DEV__ = undefined;
    });

    test('session lifecycle: refresh, get, set, clear', async () => {
        await bootShell();
        const bridge = await import('../src/lisa-bridge.js');
        await bridge.refreshSession();
        expect(bridge.getSession().accessTier).toBe('agent');
        expect(bridge.getSession().authenticated).toBe(true);

        window.__TAURI__ = stubTauri({ invoke: async (cmd) => (cmd === 'get_session_info' ? { accessTier: 'super-admin', authenticated: true } : null) });
        await bridge.setSession({ accessTier: 'super-admin' });
        expect(bridge.getSession().accessTier).toBe('super-admin');

        window.__TAURI__ = stubTauri();
        await bridge.clearSession();
        expect(bridge.getSession().authenticated).toBe(false);
        expect(document.getElementById('veil-auth-panel')).not.toBeNull();

        window.__TAURI__ = stubTauri({ invoke: async (cmd) => { if (cmd === 'clear_session') throw new Error('no'); return null; } });
        await bridge.clearSession();
        expect(bridge.getSession().authenticated).toBe(false);
    });

    test('initLISABridge wires tauri events, loading events, and section bridge', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        const { initLISABridge } = await import('../src/lisa-bridge.js');
        await initLISABridge(window.tabManager);
        expect(window.tabWindowBridge).toBeDefined();

        tauri.__emit('veil:navigate', { tabId: 1, url: 'https://emit.test/' });
        tauri.__emit('veil:tab-meta', { tabId: 1, title: 'Emitted' });

        const tab = window.tabManager.createTab();
        window.dispatchEvent(new CustomEvent('veil:tab-loading', { detail: { tabId: tab.id, loading: true } }));
        expect(tab.loading).toBe(true);

        window.dispatchEvent(new Event('resize'));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(tauri.__invocations.map((i) => i.cmd)).toContain('tab_window_sync_rect');

        window.tabWindowBridge.onSectionLeave();
        expect(tauri.__invocations.map((i) => i.cmd)).toContain('tab_window_hide_all');
        window.tabWindowBridge.onSectionEnter();
        expect(tauri.__invocations.map((i) => i.cmd)).toContain('tab_window_activate');
    });

    test('auth panel: init/show/hide and successful code resolution', async () => {
        await bootShell();
        const auth = await import('../src/lisa/lisa-bridge-auth-ui.js');
        auth.initAuthPanel();
        auth.initAuthPanel();
        const panel = document.getElementById('veil-auth-panel');
        expect(panel).not.toBeNull();
        expect(document.querySelectorAll('#veil-auth-panel').length).toBe(1);

        auth.showAuthPanel();
        expect(panel.style.display).toBe('flex');
        auth.hideAuthPanel();
        expect(panel.style.display).toBe('none');

        const input = panel.querySelector('#veil-shortcode-input');
        const submit = panel.querySelector('#veil-auth-submit');
        input.value = 'good-code';
        submit.dispatchEvent(new Event('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(panel.style.display).toBe('none');

        input.value = 'bad-code';
        window.__TAURI__ = stubTauri({ invoke: async (cmd) => { if (cmd === 'auth_resolve_code') return {}; return null; } });
        submit.dispatchEvent(new Event('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(panel.querySelector('#veil-auth-error').style.display).toBe('block');

        window.__TAURI__ = stubTauri({ invoke: async (cmd) => { if (cmd === 'auth_resolve_code') throw new Error('native only'); return null; } });
        input.value = 'throwing-code';
        submit.dispatchEvent(new Event('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(panel.querySelector('#veil-auth-error').textContent).toContain('native only');

        input.value = '';
        submit.dispatchEvent(new Event('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

    test('message listener submits access requests and honors proceed-anyway', async () => {
        await bootShell();
        const bridge = await import('../src/lisa-bridge.js');
        const calls = [];
        window.tabManager.navigateActiveTab = (url) => calls.push(url);
        await bridge.initLISABridge(window.tabManager);

        window.dispatchEvent(new MessageEvent('message', { data: { type: 'veil:access-request', domain: 'req.test', reason: 'work' } }));
        window.dispatchEvent(new MessageEvent('message', { data: { type: 'veil:proceed-anyway', domain: 'override.test' } }));
        window.dispatchEvent(new MessageEvent('message', { data: null }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(calls).toEqual(['override.test']);
    });

    test('injectLisaStatusIndicator appends to the titlebar and toggles auth panel', async () => {
        await bootShell();
        const { initLISABridge } = await import('../src/lisa-bridge.js');
        await initLISABridge(window.tabManager);
        const indicator = document.getElementById('lisa-status-indicator');
        expect(indicator).not.toBeNull();
        expect(indicator.textContent).toBe('LISA: agent');
        indicator.click();
        expect(document.getElementById('veil-auth-panel')).toBeNull();

        window.__TAURI__ = stubTauri({ invoke: async () => ({ accessTier: 'locked', authenticated: false }) });
        const bridge = await import('../src/lisa-bridge.js');
        await bridge.refreshSession();
        expect(indicator.textContent).toBe('LISA: unauthenticated');
    });
});
