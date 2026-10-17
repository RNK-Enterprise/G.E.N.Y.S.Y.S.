/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS - admin ops lifecycle coverage
 * Copyright (c) 2026 Asgard Innovations / RNK. All Rights Reserved.
 */

import { beforeEach, describe, expect, test } from '@jest/globals';
import { mountAdminOps } from '../src/genysys-admin-ops.js';

const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};

beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
});

describe('admin ops: authorization and lifecycle', () => {
    test('guards missing mounts and unauthorized tiers', () => {
        mountAdminOps(null, 'super-admin');
        const mount = document.createElement('div');
        mountAdminOps(mount, 'agent');
        expect(mount.textContent).toContain('Policy authorization required');
    });

    test('renders authorized tabs, refreshes every source, and records audit entries', async () => {
        const mount = document.createElement('div');
        document.body.appendChild(mount);
        mountAdminOps(mount, 'super-admin');
        await flush();
        expect(mount.querySelector('.ops-plane-tier').textContent).toBe('super-admin');
        expect(mount.querySelectorAll('.ops-tab')).toHaveLength(5);
        expect(mount.textContent).toContain('Log source not wired yet');

        for (const tab of mount.querySelectorAll('.ops-tab')) {
            tab.click();
            await flush();
            expect(tab.classList.contains('active')).toBe(true);
        }
        for (const button of mount.querySelectorAll('.ops-refresh-btn')) {
            button.click();
            await flush();
        }
        expect(JSON.parse(localStorage.getItem('genysys-admin-audit'))).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ action: 'log_fetch' }),
                expect.objectContaining({ action: 'fleet_status_fetch' }),
            ]),
        );
    });

    test('renders an empty audit panel and escapes stored audit fields', async () => {
        const emptyMount = document.createElement('div');
        document.body.appendChild(emptyMount);
        mountAdminOps(emptyMount, 'dev');
        await flush();
        localStorage.removeItem('genysys-admin-audit');
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            if (key === 'genysys-admin-audit' && String(value).includes('tab_switch')) return;
            originalSetItem.call(this, key, value);
        };
        emptyMount.querySelector('[data-tab="audit"]').click();
        Storage.prototype.setItem = originalSetItem;
        expect(emptyMount.querySelector('#ops-feed-audit').textContent).toContain('No audit entries');

        const mount = document.createElement('div');
        document.body.appendChild(mount);
        localStorage.setItem('genysys-admin-audit', JSON.stringify([
            { ts: '<img src=x>', action: '<b>action</b>', detail: '<script>bad</script>' },
        ]));
        mountAdminOps(mount, 'dev');
        await flush();
        const audit = JSON.parse(localStorage.getItem('genysys-admin-audit'));
        audit.push({ ts: 'safe', action: 'no-detail', detail: '' });
        localStorage.setItem('genysys-admin-audit', JSON.stringify(audit));
        mount.querySelector('[data-tab="audit"]').click();
        const feed = mount.querySelector('#ops-feed-audit');
        expect(feed.querySelector('img')).toBeNull();
        expect(feed.querySelector('script')).toBeNull();
        expect(feed.textContent).toContain('<b>action</b>');
    });

    test('caps the local audit trail at 500 entries', async () => {
        const mount = document.createElement('div');
        document.body.appendChild(mount);
        mountAdminOps(mount, 'super-admin');
        for (let i = 0; i < 510; i++) {
            mount.querySelector('[data-tab="chain"]').click();
        }
        await flush();
        expect(JSON.parse(localStorage.getItem('genysys-admin-audit'))).toHaveLength(500);
    });
});
