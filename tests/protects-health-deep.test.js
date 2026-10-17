/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS - P.R.O.T.E.C.T.S. health coverage
 * Copyright (c) 2026 Asgard Innovations / RNK. All Rights Reserved.
 */

import { beforeEach, describe, expect, test } from '@jest/globals';
import { mountProtectsHealth } from '../src/protection/protects-health.js';

const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};

beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    if (!globalThis.AbortSignal?.timeout) {
        globalThis.AbortSignal = globalThis.AbortSignal || function AbortSignal() {};
        globalThis.AbortSignal.timeout = () => undefined;
    }
});

describe('protects health: rendering and refresh paths', () => {
    test('guards missing mounts and renders connected organ states', async () => {
        mountProtectsHealth(null);
        const mount = document.createElement('div');
        mount.id = 'health-mount';
        document.body.appendChild(mount);
        localStorage.setItem('axis_resolute_url', 'http://legacy.test:7781');
        globalThis.fetch = async () => ({
            ok: true,
            json: async () => ({
                connected: true,
                organs: {
                    resolute: 'ACTIVE',
                    policyEngine: 'inactive',
                    attestation: 42,
                    chainRouting: 'DARK',
                    heartbeat: 'BEATING',
                },
            }),
        });
        mountProtectsHealth(mount);
        await flush();
        expect(mount.querySelectorAll('.sc-card')).toHaveLength(7);
        expect(mount.textContent).toContain('REACHABLE');
        expect(mount.textContent).toContain('UNKNOWN');

        const input = mount.querySelector('#protects-url-input');
        input.value = '   ';
        mount.querySelector('#protects-url-save').click();
        input.value = 'http://new.test:7781/';
        mount.querySelector('#protects-url-save').click();
        await flush();
        expect(localStorage.getItem('genysys_resolute_url')).toBe('http://new.test:7781/');
    });

    test('renders fail-closed status, rejects bad responses, and escapes dynamic values', async () => {
        const mount = document.createElement('div');
        document.body.appendChild(mount);
        const hostile = '<img src=x onerror=alert(1)>';
        localStorage.setItem('genysys_resolute_url', hostile);
        let mode = 'bad';
        globalThis.fetch = async () => {
            if (mode === 'bad') return { ok: false, status: 503, json: async () => ({}) };
            throw new Error('dark');
        };
        mountProtectsHealth(mount);
        await flush();
        expect(mount.textContent).toContain('HOLD');
        expect(mount.querySelector('img')).toBeNull();
        expect(mount.querySelector('#protects-url-input').value).toBe(hostile);

        mode = 'throw';
        mount.querySelector('#protects-refresh-btn').click();
        await flush();
        expect(mount.textContent).toContain('HOLD');

        mount.querySelector('#protects-gate-card').remove();
        mount.querySelector('#protects-organ-cards').remove();
        mount.querySelector('#protects-refresh-btn').click();
        await flush();
    });

    test('uses the default URL when no persisted URL exists', async () => {
        const mount = document.createElement('div');
        document.body.appendChild(mount);
        globalThis.fetch = async () => ({ ok: true, json: async () => ({ connected: false }) });
        mountProtectsHealth(mount);
        await flush();
        expect(mount.querySelector('#protects-url-input').value).toBe('http://127.0.0.1:7781');
        expect(mount.textContent).toContain('HOLD');
    });
});
