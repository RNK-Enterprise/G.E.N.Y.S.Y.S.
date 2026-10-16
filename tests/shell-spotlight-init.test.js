/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS™ — spotlight initialization path coverage
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import { describe, expect, test, beforeEach } from '@jest/globals';
import {
    bootShell,
    resetShellDom,
    resetModuleRegistry,
    quietLogs,
    drainListeners,
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

describe('shell: spotlight initialization', () => {
    test('loading documents defer initialization until DOMContentLoaded', async () => {
        await bootShell({ skipModules: ['./shell/spotlight-suggestions.js'] });
        const prior = document.readyState;
        Object.defineProperty(document, 'readyState', {
            configurable: true,
            get: () => 'loading',
        });
        try {
            await import(new URL('../src/shell/spotlight-suggestions.js?loading-only', import.meta.url).href);
            expect(document.getElementById('spotlight-btn').dataset.spotlightBound).toBeUndefined();
            document.dispatchEvent(new Event('DOMContentLoaded'));
            expect(document.getElementById('spotlight-btn').dataset.spotlightBound).toBe('1');
        } finally {
            Object.defineProperty(document, 'readyState', { configurable: true, value: prior });
        }
    });

    test('already-bound controls do not receive duplicate listeners', async () => {
        await bootShell({ skipModules: ['./shell/spotlight-suggestions.js'] });
        document.getElementById('spotlight-btn').dataset.spotlightBound = '1';
        document.getElementById('spotlight-close').dataset.spotlightBound = '1';
        const prior = document.readyState;
        Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
        try {
            await import(new URL('../src/shell/spotlight-suggestions.js?already-bound-only', import.meta.url).href);
            expect(document.getElementById('spotlight-btn').dataset.spotlightBound).toBe('1');
            expect(document.getElementById('spotlight-close').dataset.spotlightBound).toBe('1');
        } finally {
            Object.defineProperty(document, 'readyState', { configurable: true, value: prior });
        }
    });
});
