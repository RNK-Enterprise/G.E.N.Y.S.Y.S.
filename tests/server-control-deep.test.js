/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS - server control runtime coverage
 * Copyright (c) 2026 Asgard Innovations / RNK. All Rights Reserved.
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};

let control;

beforeEach(() => {
    document.body.innerHTML = '<div id="server-control-mount"></div>';
    localStorage.clear();
    sessionStorage.clear();
    if (!globalThis.AbortSignal?.timeout) {
        globalThis.AbortSignal = globalThis.AbortSignal || function AbortSignal() {};
        globalThis.AbortSignal.timeout = () => undefined;
    }
    jest.useFakeTimers();
});

afterEach(() => {
    control?.unmountServerControl();
    control = null;
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

async function loadControl() {
    jest.resetModules();
    control = await import(`../src/genysys-server-control.js?case=${Date.now()}-${Math.random()}`);
    return control;
}

describe('server control: mount, status, and URL paths', () => {
    test('guards missing mounts and renders unreachable status with escaped URL', async () => {
        globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
        const mod = await loadControl();
    mod.unmountServerControl();
        await mod.mountServerControl('missing-mount');
        localStorage.setItem('genysys_resolute_url', '<img src=x>');
        await mod.mountServerControl();
        const mount = document.getElementById('server-control-mount');
        expect(mount.querySelector('.sc-status-error').querySelector('img')).toBeNull();
        expect(mount.querySelector('#sc-lisa-url').value).toBe('<img src=x>');
        mount.querySelector('#sc-lisa-url').value = '   ';
        mount.querySelector('#sc-lisa-url-save').click();
        expect(localStorage.getItem('genysys_resolute_url')).toBe('<img src=x>');
    });

    test('renders all status cards, refreshes on interval, and reuses the session id', async () => {
        const calls = [];
        globalThis.fetch = async (url, options = {}) => {
            calls.push({ url: String(url), options });
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    nukeEngine: 'ARMED', oceanListener: 'LISTENING', biosigAuth: 'ACTIVE',
                    jumpDrive: 'READY', heartbeat: 'BEATING', miabListener: 'UP',
                    miabIssuer: 'UP', miabValidator: 'UP', testMode: 'IDLE',
                }),
            };
        };
        const mod = await loadControl();
        await mod.mountServerControl();
        await mod.mountServerControl();
        const mount = document.getElementById('server-control-mount');
        expect(mount.querySelectorAll('#sc-layer1-cards .sc-card')).toHaveLength(9);
        jest.advanceTimersByTime(30_000);
        await flush();
        expect(calls.filter(call => call.url.endsWith('/health')).length).toBeGreaterThan(1);

        const toggle = mount.querySelector('#sc-tm-toggle');
        const activeToggle = mount.querySelector('#sc-tm-toggle');
        activeToggle.checked = false;
        activeToggle.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        const revokeBody = JSON.parse(calls.find(call => call.url.includes('/revoke')).options.body);
        expect(revokeBody.sessionId).toBe(sessionStorage.getItem('genysys-server-control-session'));
        mount.querySelector('.sc-scope-check input').dispatchEvent(new Event('change', { bubbles: true }));
        mount.querySelector('#sc-layer1-cards').remove();
        mount.querySelector('#sc-tm-container').remove();
        mount.querySelector('#sc-refresh-btn').click();
        await flush();
    });
});

describe('server control: issue, revoke, and expiry paths', () => {
    test('issues a token with scope fallback, renders it safely, and revokes it', async () => {
        const calls = [];
        globalThis.fetch = async (url, options = {}) => {
            calls.push({ url: String(url), options });
            if (String(url).includes('/issue')) {
                return { ok: true, status: 200, json: async () => ({ ok: true, tokenId: '<token>', expiresAt: undefined }) };
            }
            if (String(url).includes('/revoke')) return { ok: true, status: 200, json: async () => ({ ok: true }) };
            return { ok: true, status: 200, json: async () => ({ connected: true }) };
        };
        const mod = await loadControl();
        await mod.mountServerControl();
        const mount = document.getElementById('server-control-mount');
        mount.querySelectorAll('.sc-scope-check input').forEach(check => { check.checked = false; });
        const toggle = mount.querySelector('#sc-tm-toggle');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        expect(mount.querySelector('.sc-tm-token').textContent).toContain('<token>'.slice(0, 8));
        expect(mount.querySelector('.sc-tm-token').querySelector('token')).toBeNull();
        const issueBody = JSON.parse(calls.find(call => call.url.includes('/issue')).options.body);
        expect(issueBody.scope).toEqual(['benchmark']);
        const secondIssueToggle = mount.querySelector('#sc-tm-toggle');
        secondIssueToggle.checked = true;
        secondIssueToggle.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        mount.querySelector('#sc-tm-expiry').remove();
        jest.advanceTimersByTime(1000);
        await flush();
        const activeToggle = mount.querySelector('#sc-tm-toggle');
        activeToggle.checked = false;
        activeToggle.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        expect(mount.querySelector('#sc-tm-toggle').checked).toBe(false);
    });

    test('handles missing status controls while issuing test mode', async () => {
        globalThis.fetch = async url => {
            if (String(url).includes('/issue')) return { ok: true, status: 200, json: async () => ({ ok: true, tokenId: 'token' }) };
            return { ok: true, status: 200, json: async () => ({}) };
        };
        const mod = await loadControl();
        await mod.mountServerControl();
        const mount = document.getElementById('server-control-mount');
        mount.querySelector('#sc-tm-status').remove();
        const toggle = mount.querySelector('#sc-tm-toggle');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        expect(mount.querySelector('#sc-tm-toggle').checked).toBe(true);
    });

    test('reports issue and revoke HTTP/error failures and reverts issue toggle', async () => {
        let issueMode = 'http';
        globalThis.fetch = async url => {
            const target = String(url);
            if (target.includes('/issue') && issueMode === 'http') return { ok: false, status: 500 };
            if (target.includes('/issue')) throw new Error('issue down');
            if (target.includes('/revoke') && issueMode === 'revoke-http') return { ok: false, status: 502 };
            if (target.includes('/revoke')) throw new Error('revoke down');
            return { ok: true, status: 200, json: async () => ({}) };
        };
        const mod = await loadControl();
        await mod.mountServerControl();
        const mount = document.getElementById('server-control-mount');
        const toggle = mount.querySelector('#sc-tm-toggle');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        expect(mount.querySelector('#sc-tm-status').textContent).toContain('HTTP 500');
        expect(mount.querySelector('#sc-tm-toggle').checked).toBe(false);
        issueMode = 'error';
        const retryToggle = mount.querySelector('#sc-tm-toggle');
        retryToggle.checked = true;
        retryToggle.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        expect(mount.querySelector('#sc-tm-status').textContent).toContain('issue down');
        issueMode = 'revoke-http';
        const revokeToggle = mount.querySelector('#sc-tm-toggle');
        revokeToggle.checked = false;
        revokeToggle.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        issueMode = 'error';
        const errorRevokeToggle = mount.querySelector('#sc-tm-toggle');
        errorRevokeToggle.checked = false;
        errorRevokeToggle.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        expect(mount.querySelector('#sc-tm-container').textContent).not.toContain('revoke down');
    });

    test('handles a failed issue after its controls are detached', async () => {
        let mount;
        globalThis.fetch = async url => {
            if (String(url).includes('/issue')) {
                mount.querySelector('#sc-tm-container').remove();
                return { ok: false, status: 500 };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        };
        const mod = await loadControl();
        await mod.mountServerControl();
        mount = document.getElementById('server-control-mount');
        const toggle = mount.querySelector('#sc-tm-toggle');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        expect(mount.querySelector('#sc-tm-container')).toBeNull();
    });

    test('expires active tokens and safely handles missing expiry DOM', async () => {
        globalThis.fetch = async url => {
            if (String(url).includes('/issue')) return { ok: true, status: 200, json: async () => ({ ok: true, tokenId: 'token', expiresAt: Date.now() - 1 }) };
            return { ok: true, status: 200, json: async () => ({}) };
        };
        const mod = await loadControl();
        await mod.mountServerControl();
        const mount = document.getElementById('server-control-mount');
        const toggle = mount.querySelector('#sc-tm-toggle');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        document.getElementById('sc-tm-expiry').remove();
        jest.advanceTimersByTime(1000);
        await flush();
        expect(mount.querySelector('#sc-tm-toggle').checked).toBe(false);
        mod.unmountServerControl();
    });

    test('handles expiry after the mount has been detached', async () => {
        globalThis.fetch = async url => {
            if (String(url).includes('/issue')) return { ok: true, status: 200, json: async () => ({ ok: true, tokenId: 'token', expiresAt: Date.now() - 1 }) };
            return { ok: true, status: 200, json: async () => ({}) };
        };
        const mod = await loadControl();
        await mod.mountServerControl();
        const mount = document.getElementById('server-control-mount');
        const toggle = mount.querySelector('#sc-tm-toggle');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        mount.remove();
        jest.advanceTimersByTime(1000);
        await flush();
        expect(document.getElementById('server-control-mount')).toBeNull();
    });
});
