/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS™ — POLICY bridge coverage
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
    quietLogs();
    drainListeners();
});

describe('policy-bridge', () => {
    test('normalizeUrl covers domains, queries, internal schemes, and garbage', async () => {
        await bootShell();
        expect(window.normalizeUrl('https://ok.test/a')).toBe('https://ok.test/a');
        expect(window.normalizeUrl('genysys://newtab')).toBe('genysys://newtab');
        expect(window.normalizeUrl('example.com')).toBe('https://example.com');
        expect(window.normalizeUrl('best browser')).toBe('https://duckduckgo.com/?q=best%20browser');
        expect(window.normalizeUrl('')).toBe('genysys://newtab');
        expect(window.normalizeUrl(null)).toBe('genysys://newtab');
        expect(window.normalizeUrl('   ')).toBe('genysys://newtab');
    });

    test('navigateWithPolicy allow/flag paths dispatch policy-allow', async () => {
        const tauri = stubTauri({ invoke: (cmd, args) => (cmd === 'navigate_tab' ? { decision: 'flag', reason: 'low', domain: args.url } : null) });
        await bootShell({ tauri });
        const { navigateWithPolicy } = await import('../src/policy-bridge.js');
        const events = [];
        window.addEventListener('genysys:policy-allow', (e) => events.push(e.detail.url));
        let allowed = 0;
        const policy = await navigateWithPolicy(1, 'https://flag.test/', () => allowed++, () => { });
        expect(policy.decision).toBe('flag');
        expect(allowed).toBe(1);
        expect(events).toEqual(['https://flag.test/']);
        expect(document.getElementById('status-text').textContent).toContain('G.E.N.E.S.Y.S. flagged');
    });

    test('navigateWithPolicy block/quarantine/chain/unknown fail closed', async () => {
        await bootShell();
        const { navigateWithPolicy } = await import('../src/policy-bridge.js');
        const decisions = ['block', 'quarantine', 'chain', 'mystery'];
        for (const decision of decisions) {
            window.__TAURI__ = stubTauri({ invoke: (cmd) => (cmd === 'navigate_tab' ? { decision } : null) });
            let blocked = 0;
            const policy = await navigateWithPolicy(1, 'https://x.test/', () => { }, () => blocked++);
            expect(blocked).toBe(1);
            if (decision === 'quarantine') expect(policy.quarantined).toBe(true);
        }
    });

    test('navigateWithPolicy fail-closed when the bridge throws or returns garbage', async () => {
        await bootShell();
        const { navigateWithPolicy } = await import('../src/policy-bridge.js');

        window.__TAURI__ = stubTauri({ invoke: async () => { throw new Error('dark'); } });
        let blocked = 0;
        const policy = await navigateWithPolicy(1, 'https://dark.test/', () => { }, () => blocked++);
        expect(policy.decision).toBe('block');
        expect(policy.reason).toBe('policy_unreachable_fail_closed');
        expect(blocked).toBe(1);

        window.__TAURI__ = stubTauri({ invoke: async () => null });
        let blocked2 = 0;
        const policy2 = await navigateWithPolicy(1, 'https://void.test/', () => { }, () => blocked2++);
        expect(policy2.reason).toBe('missing_policy_fail_closed');
        expect(blocked2).toBe(1);
    });

    test('tauriInvoke dev fallback blocks without bypass', async () => {
        await bootShell();
        const { tauriInvoke } = await import('../src/policy-bridge.js');
        window.__TAURI__ = undefined;
        const result = await tauriInvoke('navigate_tab', { url: 'https://dev.test/' });
        expect(result.decision).toBe('block');
        expect(result.reason).toBe('policy_unreachable_fail_closed');
        expect(await tauriInvoke('unknown_command', {})).toBeNull();
        await expect(tauriInvoke('auth_resolve_code', { code: 'x' })).rejects.toThrow('Auth requires GENYSYS native shell');
    });

    test('tauriInvoke dev bypass allows when DEV and flag are set', async () => {
        globalThis.__GENYSYS_DEV__ = true;
        localStorage.setItem('genysys_dev_bypass', 'true');
        await bootShell();
        const { tauriInvoke } = await import('../src/policy-bridge.js');
        window.__TAURI__ = undefined;
        const bypassed = await tauriInvoke('navigate_tab', { url: 'https://dev.test/' });
        expect(bypassed.decision).toBe('allow');
        expect(bypassed.reason).toBe('dev_bypass_allow');
        await expect(tauriInvoke('auth_resolve_code', { code: 'x' })).resolves.toMatchObject({ tier: 'dev' });
        localStorage.removeItem('genysys_dev_bypass');
        globalThis.__GENYSYS_DEV__ = undefined;
    });

    test('session lifecycle: refresh, get, set, clear', async () => {
        await bootShell();
        const bridge = await import('../src/policy-bridge.js');
        await bridge.refreshSession();
        expect(bridge.getSession().accessTier).toBe('agent');
        expect(bridge.getSession().authenticated).toBe(true);

        window.__TAURI__ = stubTauri({ invoke: async (cmd) => (cmd === 'get_session_info' ? { accessTier: 'super-admin', authenticated: true } : null) });
        await bridge.setSession({ accessTier: 'super-admin' });
        expect(bridge.getSession().accessTier).toBe('super-admin');

        window.__TAURI__ = stubTauri();
        await bridge.clearSession();
        expect(bridge.getSession().authenticated).toBe(false);
        expect(document.getElementById('genysys-auth-panel')).not.toBeNull();

        window.__TAURI__ = stubTauri({ invoke: async (cmd) => { if (cmd === 'clear_session') throw new Error('no'); return null; } });
        await bridge.clearSession();
        expect(bridge.getSession().authenticated).toBe(false);
    });

    test('initPolicyBridge wires tauri events, loading events, and section bridge', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        const { initPolicyBridge } = await import('../src/policy-bridge.js');
        await initPolicyBridge(window.tabManager);
        expect(window.tabWindowBridge).toBeDefined();

        tauri.__emit('genysys:navigate', { tabId: 1, url: 'https://emit.test/' });
        tauri.__emit('genysys:tab-meta', { tabId: 1, title: 'Emitted' });

        const tab = window.tabManager.createTab();
        window.dispatchEvent(new CustomEvent('genysys:tab-loading', { detail: { tabId: tab.id, loading: true } }));
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
        const auth = await import('../src/protection/access-auth-ui.js');
        auth.initAuthPanel();
        auth.initAuthPanel();
        const panel = document.getElementById('genysys-auth-panel');
        expect(panel).not.toBeNull();
        expect(document.querySelectorAll('#genysys-auth-panel').length).toBe(1);

        auth.showAuthPanel();
        expect(panel.style.display).toBe('flex');
        auth.hideAuthPanel();
        expect(panel.style.display).toBe('none');

        const input = panel.querySelector('#genysys-shortcode-input');
        const submit = panel.querySelector('#genysys-auth-submit');
        input.value = 'good-code';
        submit.dispatchEvent(new Event('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(panel.style.display).toBe('none');

        input.value = 'bad-code';
        window.__TAURI__ = stubTauri({ invoke: async (cmd) => { if (cmd === 'auth_resolve_code') return {}; return null; } });
        submit.dispatchEvent(new Event('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(panel.querySelector('#genysys-auth-error').style.display).toBe('block');

        window.__TAURI__ = stubTauri({ invoke: async (cmd) => { if (cmd === 'auth_resolve_code') throw new Error('native only'); return null; } });
        input.value = 'throwing-code';
        submit.dispatchEvent(new Event('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(panel.querySelector('#genysys-auth-error').textContent).toContain('native only');

        input.value = '';
        submit.dispatchEvent(new Event('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

    test('message listener submits access requests and honors proceed-anyway', async () => {
        await bootShell();
        const bridge = await import('../src/policy-bridge.js');
        const calls = [];
        window.tabManager.navigateActiveTab = (url) => calls.push(url);
        await bridge.initPolicyBridge(window.tabManager);

        window.dispatchEvent(new MessageEvent('message', { data: { type: 'genysys:access-request', domain: 'req.test', reason: 'work' } }));
        window.dispatchEvent(new MessageEvent('message', { data: { type: 'genysys:proceed-anyway', domain: 'override.test' } }));
        window.dispatchEvent(new MessageEvent('message', { data: null }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(calls).toEqual(['override.test']);
    });

    test('injectPolicyStatusIndicator appends to the titlebar and toggles auth panel', async () => {
        await bootShell();
        const { initPolicyBridge } = await import('../src/policy-bridge.js');
        await initPolicyBridge(window.tabManager);
        const indicator = document.getElementById('policy-status-indicator');
        expect(indicator).not.toBeNull();
        expect(indicator.textContent).toBe('G.E.N.E.S.Y.S.: agent');
        indicator.click();
        expect(document.getElementById('genysys-auth-panel')).toBeNull();

        window.__TAURI__ = stubTauri({ invoke: async () => ({ accessTier: 'locked', authenticated: false }) });
        const bridge = await import('../src/policy-bridge.js');
        await bridge.refreshSession();
        expect(indicator.textContent).toBe('G.E.N.E.S.Y.S.: unauthenticated');
    });
});
