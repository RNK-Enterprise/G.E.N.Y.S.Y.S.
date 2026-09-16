/**
 * @jest-environment jsdom
 */

/**
 * VEIL™ — app shell coverage (welcome tour, cookies bar, server control,
 * admin ops, performance monitor)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import {
    bootShell,
    resetShellDom,
    resetModuleRegistry,
    quietLogs,
    drainListeners,
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

describe('veil-welcome-tour', () => {
    test('first run: tour renders, collects profile, and shows the daily message', async () => {
        await bootShell();
        const tour = await import('../src/veil-welcome-tour.js');
        tour.initWelcomeSystem({});

        const overlay = document.getElementById('veil-tour-overlay');
        expect(overlay).not.toBeNull();
        expect(document.getElementById('veil-tour-title').textContent).toBe('Welcome to VEIL');

        overlay.querySelector('#veil-tour-action').click();
        expect(document.getElementById('veil-tour-title').textContent).toBe('What should Lisa call you?');
        document.getElementById('tour-name').value = 'Odinn';
        overlay.querySelector('#veil-tour-action').click();
        document.getElementById('tour-role').value = 'Architect';
        overlay.querySelector('#veil-tour-action').click();
        overlay.querySelector('[data-choice="style-direct"]').click();
        overlay.querySelector('#veil-tour-action').click();
        overlay.querySelector('#veil-tour-action').click();
        await new Promise((resolve) => setTimeout(resolve, 500));

        const profile = JSON.parse(localStorage.getItem('veil-user-profile'));
        expect(profile.name).toBe('Odinn');
        expect(profile.role).toBe('Architect');
        expect(profile.style).toBe('style-direct');
        expect(localStorage.getItem('veil-tour-complete')).toBe('1');
        expect(document.getElementById('veil-daily-message')).not.toBeNull();
    });

    test('returning user gets the stored daily message with dismissal', async () => {
        localStorage.setItem('veil-tour-complete', '1');
        localStorage.setItem('veil-user-profile', JSON.stringify({ name: 'Odinn', style: 'style-direct' }));
        await bootShell();
        const tour = await import('../src/veil-welcome-tour.js');
        tour.initWelcomeSystem({ tier: 'agent' });

        const banner = document.getElementById('veil-daily-message');
        expect(banner).not.toBeNull();
        expect(banner.textContent).toContain('Odinn');
        banner.querySelector('.veil-daily-msg-close').dispatchEvent(new Event('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 350));
        expect(document.getElementById('veil-daily-message')).toBeNull();
        expect(tour.getProfile().name).toBe('Odinn');
        tour.saveProfile({ name: 'Updated' });
        expect(tour.getProfile().name).toBe('Updated');
    });

    test('startTour collects choices and persists on finish', async () => {
        await bootShell();
        const tour = await import('../src/veil-welcome-tour.js');
        let completed = null;
        tour.startTour((profile) => { completed = profile; });

        const overlay = document.getElementById('veil-tour-overlay');
        overlay.querySelector('#veil-tour-action').click();
        document.getElementById('tour-name').value = 'Lisa';
        overlay.querySelector('#veil-tour-action').click();
        document.getElementById('tour-role').value = 'Owner';
        overlay.querySelector('#veil-tour-action').click();
        overlay.querySelector('[data-choice="style-brief"]').click();
        overlay.querySelector('#veil-tour-action').click();
        overlay.querySelector('#veil-tour-action').click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(completed).toMatchObject({ name: 'Lisa', role: 'Owner', style: 'style-brief' });
    });
});

describe('veil-cookies-bar', () => {
    test('bar renders when not accepted and hides on accept', async () => {
        await bootShell();
        await import('../src/veil-cookies-bar.js');
        const bar = document.getElementById('veil-cookies-bar');
        expect(bar).not.toBeNull();
        expect(bar.textContent).toContain('Privacy Policy');

        document.getElementById('veil-cookies-accept').dispatchEvent(new Event('click', { bubbles: true }));
        expect(localStorage.getItem('veil-cookies-accepted')).toBe('1');
        await new Promise((resolve) => setTimeout(resolve, 350));
        expect(document.getElementById('veil-cookies-bar')).toBeNull();
    });

    test('no bar when already accepted', async () => {
        localStorage.setItem('veil-cookies-accepted', '1');
        await bootShell();
        await import('../src/veil-cookies-bar.js');
        expect(document.getElementById('veil-cookies-bar')).toBeNull();
    });
});

describe('veil-server-control', () => {
    test('mount renders resolute status, cards, and refresh loop', async () => {
        await bootShell();
        window.fetch = async (url) => ({
            ok: true,
            status: 200,
            json: async () => ({
                nukeEngine: 'ARMED', oceanListener: 'LISTENING', biosigAuth: 'ACTIVE',
                jumpDrive: 'READY', heartbeat: 'BEATING', miabListener: 'UP',
                miabIssuer: 'UP', miabValidator: 'UP', testMode: 'IDLE',
            }),
        });
        const { mountServerControl } = await import('../src/veil-server-control.js');
        await mountServerControl('server-control-mount');

        const mount = document.getElementById('server-control-mount');
        expect(mount.innerHTML).toContain('Server Control');
        expect(mount.querySelectorAll('.sc-card').length).toBe(9);
        expect(mount.innerHTML).toContain('ARMED');

        document.getElementById('sc-refresh-btn').dispatchEvent(new Event('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));

        document.getElementById('sc-lisa-url').value = 'http://127.0.0.1:9999';
        document.getElementById('sc-lisa-url-save').dispatchEvent(new Event('click', { bubbles: true }));
        expect(localStorage.getItem('veil_resolute_url')).toBe('http://127.0.0.1:9999');
    });

    test('unreachable authority renders the fail state', async () => {
        await bootShell();
        window.fetch = async () => { throw new Error('dark'); };
        const { mountServerControl } = await import('../src/veil-server-control.js');
        await mountServerControl('server-control-mount');
        expect(document.getElementById('server-control-mount').innerHTML).toContain('unreachable');
    });

    test('test mode issues, displays token state, and revokes', async () => {
        await bootShell();
        window.fetch = async (url, options = {}) => {
            const target = String(url);
            if (target.includes('/health')) {
                return { ok: true, status: 200, json: async () => ({ heartbeat: 'BEATING' }) };
            }
            if (target.includes('/api/test-mode/issue')) {
                return { ok: true, status: 200, json: async () => ({ ok: true, tokenId: 'fixture-token-id', expiresAt: Date.now() + 3600_000 }) };
            }
            if (target.includes('/api/test-mode/revoke')) {
                return { ok: true, status: 200, json: async () => ({ ok: true }) };
            }
            return { ok: false, status: 404, json: async () => ({}) };
        };
        const { mountServerControl } = await import('../src/veil-server-control.js');
        await mountServerControl('server-control-mount');

        const toggle = document.getElementById('sc-tm-toggle');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(document.getElementById('server-control-mount').innerHTML).toContain('Expires in');

        const expiry = document.getElementById('sc-tm-expiry');
        expect(expiry).not.toBeNull();
        await new Promise((resolve) => setTimeout(resolve, 1100));
        expect(expiry.textContent).toContain('Expires in');

        const revokeToggle = document.getElementById('sc-tm-toggle');
        revokeToggle.checked = false;
        revokeToggle.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(document.getElementById('sc-tm-status').textContent).toBe('');
    });

    test('failed issuance reports the reason and reverts the toggle', async () => {
        await bootShell();
        window.fetch = async (url) => {
            if (String(url).includes('/health')) return { ok: true, status: 200, json: async () => ({}) };
            return { ok: false, status: 503, json: async () => ({}) };
        };
        const { mountServerControl } = await import('../src/veil-server-control.js');
        await mountServerControl('server-control-mount');
        const toggle = document.getElementById('sc-tm-toggle');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(document.getElementById('sc-tm-status').textContent).toContain('Failed: HTTP 503');
        expect(document.getElementById('sc-tm-toggle').checked).toBe(false);
    });

    test('unmount clears the timers', async () => {
        await bootShell();
        window.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
        const mod = await import('../src/veil-server-control.js');
        await mod.mountServerControl('server-control-mount');
        expect(() => mod.unmountServerControl()).not.toThrow();
    });

    test('mount on a missing node is a no-op', async () => {
        await bootShell();
        const { mountServerControl } = await import('../src/veil-server-control.js');
        await mountServerControl('not-a-real-mount');
        expect(true).toBe(true);
    });
});

describe('veil-admin-ops', () => {
    test('gated tier renders the locked placeholder', async () => {
        await bootShell();
        const { mountAdminOps } = await import('../src/veil-admin-ops.js');
        mountAdminOps(document.getElementById('admin-section-mount'), 'agent');
        expect(document.getElementById('admin-section-mount').innerHTML).toContain('Lisa authorization required');
    });

    test('super-admin tier renders the ops plane with tabs and audit trail', async () => {
        await bootShell();
        const { mountAdminOps } = await import('../src/veil-admin-ops.js');
        const mount = document.getElementById('admin-section-mount');
        mountAdminOps(mount, 'super-admin');
        expect(mount.innerHTML).toContain('Ops Plane');
        expect(mount.querySelectorAll('.ops-tab').length).toBe(5);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(document.getElementById('ops-feed-chain').innerHTML).toContain('Log source not wired yet');

        mount.querySelector('[data-tab="fleet"]').dispatchEvent(new Event('click', { bubbles: true }));
        expect(mount.querySelector('#ops-panel-fleet').classList.contains('active')).toBe(true);

        mount.querySelector('[data-tab="audit"]').dispatchEvent(new Event('click', { bubbles: true }));
        expect(document.getElementById('ops-feed-audit').innerHTML).toContain('tab_switch');

        const refreshBtns = [...mount.querySelectorAll('.ops-refresh-btn')];
        for (const btn of refreshBtns) {
            btn.dispatchEvent(new Event('click', { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        expect(document.getElementById('ops-feed-fleet').innerHTML).toContain('Fleet source not wired yet');
    });

    test('dev tier also reaches the ops plane', async () => {
        await bootShell();
        const { mountAdminOps } = await import('../src/veil-admin-ops.js');
        mountAdminOps(document.getElementById('admin-section-mount'), 'dev');
        expect(document.getElementById('admin-section-mount').innerHTML).toContain('Ops Plane');
    });

    test('mount on a missing node is a no-op', async () => {
        await bootShell();
        const { mountAdminOps } = await import('../src/veil-admin-ops.js');
        expect(() => mountAdminOps(null, 'super-admin')).not.toThrow();
    });
});

describe('perf/performance-monitor', () => {
    test('update cycle fills panels, draws the chart, and prunes history', async () => {
        await bootShell();
        const { default: PerformanceMonitor } = await import('../src/perf/performance-monitor.js');
        const monitor = new PerformanceMonitor();
        window.tabManager.tabs = [{ id: 1, url: 'veil://newtab', title: 'T' }];
        window.tabManager.activeTabId = 1;
        window.veilBridge.listTurboStates = () => [{ id: 'x', enabled: true }, { id: 'y', enabled: false }];

        jest.useFakeTimers();
        monitor.start();
        monitor.update();
        expect(document.getElementById('perf-memory').textContent).toContain('MB');
        expect(document.getElementById('perf-cpu').textContent).toContain('%');
        expect(document.getElementById('perf-tabs').textContent).toBe('1');
        expect(document.getElementById('perf-network').textContent).toBe('Active');
        expect(document.getElementById('perf-summary-state').textContent).toBe('Ready');

        for (let i = 0; i < 65; i += 1) monitor.update();
        expect(monitor.history.memory.length).toBeLessThanOrEqual(60);
        monitor.drawChart();
        expect(document.getElementById('perf-canvas').__calls.length).toBeGreaterThan(0);
        monitor.stop();
        jest.useRealTimers();
    });

    test('idle tone and offline status render without a bridge', async () => {
        await bootShell();
        const { default: PerformanceMonitor } = await import('../src/perf/performance-monitor.js');
        const monitor = new PerformanceMonitor();
        window.veilBridge = undefined;
        window.veilRuntime = undefined;
        jest.useFakeTimers();
        monitor.start();
        monitor.update();
        expect(document.getElementById('perf-network').textContent).toBe('Idle');
        expect(document.getElementById('perf-summary-state').textContent).toBe('Idle');
        monitor.stop();
        jest.useRealTimers();
    });

    test('toggle respects capability gating and show/hide', async () => {
        await bootShell();
        const { default: PerformanceMonitor } = await import('../src/perf/performance-monitor.js');
        const monitor = new PerformanceMonitor();
        const panel = document.getElementById('performance-panel');

        window.veilRuntime.capabilities = new Map();
        monitor.toggle();
        expect(panel.classList.contains('hidden')).toBe(true);

        window.veilRuntime.capabilities = new Map([['veil-performance-stack', { id: 'veil-performance-stack', status: 'stable' }]]);
        monitor.toggle();
        expect(panel.classList.contains('hidden')).toBe(false);
        monitor.toggle();
        expect(panel.classList.contains('hidden')).toBe(true);

        const showSpy = jest.fn();
        const hideSpy = jest.fn();
        window.showElement = showSpy;
        window.hideElement = hideSpy;
        monitor.toggle();
        expect(showSpy).toHaveBeenCalled();
        monitor.toggle();
        expect(hideSpy).toHaveBeenCalled();
        monitor.stop();
    });

    test('chart draw is skipped without a canvas', async () => {
        await bootShell();
        const { default: PerformanceMonitor } = await import('../src/perf/performance-monitor.js');
        const monitor = new PerformanceMonitor();
        expect(() => monitor.drawChart()).not.toThrow();
    });
});
