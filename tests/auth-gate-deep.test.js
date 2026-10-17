/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS - auth gate deep security-path coverage
 * Copyright (c) 2026 Asgard Innovations / RNK. All Rights Reserved.
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
    resetShellDom,
    resetModuleRegistry,
    stubTauri,
} from './helpers/shell-harness.js';

const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
};

beforeEach(() => {
    resetShellDom();
    resetModuleRegistry();
    localStorage.clear();
    sessionStorage.clear();
    delete window.__genysysWindowControlsBound;
    delete window.__genysysAuthenticated;
    delete window.genysysAuthSession;
    delete window.invoke;
    globalThis.__GENYSYS_DEV__ = undefined;
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    globalThis.__GENYSYS_DEV__ = undefined;
});

async function loadGate(tauri = stubTauri(), mutateDom = null) {
    window.__TAURI__ = tauri;
    if (mutateDom) mutateDom();
    await import('../src/genysys-auth-gate.js');
    await flush();
}

async function submit(value) {
    const input = document.getElementById('genysys-auth-input');
    input.value = value;
    document.getElementById('genysys-auth-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
}

describe('auth gate: session and command failure paths', () => {
    test('recovers malformed session storage and native-less auth calls', async () => {
        sessionStorage.setItem('rnk-genysys-auth-session', 'not-json{{');
        await loadGate({ invoke: null, event: { listen: async () => () => {} } });
        expect(document.getElementById('genysys-auth-gate').classList.contains('hidden')).toBe(false);

        await submit('code');
        expect(document.getElementById('genysys-auth-error').textContent).toContain('native shell required');
        document.getElementById('genysys-auth-card').dispatchEvent(new Event('animationend'));
    });

    test('handles command grant validation and each fail-closed error classification', async () => {
        const tauri = stubTauri({ invoke: (cmd) => {
            if (cmd === 'cmd_gate_status') return { hold: false, mode: 'command' };
            if (cmd === 'command_exchange') throw new Error('Handshake denied by Resolute');
            return null;
        } });
        await loadGate(tauri);
        await submit('not-json');
        expect(document.getElementById('genysys-auth-error').textContent).toContain('Paste the C.O.M.M.A.N.D.');
        await submit(JSON.stringify({ grant: 'denied' }));
        expect(document.getElementById('genysys-auth-error').textContent).toContain('Handshake denied');

        const cases = [
            ['Resolute unreachable', 'unreachable'],
            ['Resolute dark', 'fail closed'],
            ['other failure', 'other failure'],
            ['plain command failure', 'plain command failure'],
            ['', 'Exchange failed'],
        ];
        for (const [message, expected] of cases) {
            resetShellDom();
            resetModuleRegistry();
            localStorage.clear();
            sessionStorage.clear();
            const caseTauri = stubTauri({ invoke: (cmd) => {
                if (cmd === 'cmd_gate_status') return { hold: false, mode: 'command' };
                if (cmd === 'command_exchange') throw new Error(message);
                return null;
            } });
            await loadGate(caseTauri);
            await submit(JSON.stringify({ grant: 'case' }));
            expect(document.getElementById('genysys-auth-error').textContent).toContain(expected);
        }

        resetShellDom();
        resetModuleRegistry();
        localStorage.clear();
        sessionStorage.clear();
        await loadGate(stubTauri({ invoke: (cmd) => {
            if (cmd === 'cmd_gate_status') return { hold: false, mode: 'command' };
            if (cmd === 'command_exchange') throw null;
            return null;
        } }));
        await submit(JSON.stringify({ grant: 'null-error' }));
        expect(document.getElementById('genysys-auth-error').textContent).toBe('Exchange failed');
    });

    test('accepts a grant with fallback fields when set_session fails', async () => {
        const tauri = stubTauri({ invoke: async (cmd) => {
            if (cmd === 'cmd_gate_status') return { hold: false, mode: 'command' };
            if (cmd === 'command_exchange') return { token: 'grant-token' };
            if (cmd === 'set_session') throw new Error('preview bridge');
            return null;
        } });
        await loadGate(tauri);
        await submit(JSON.stringify({ grant: 'valid' }));
        expect(document.getElementById('genysys-auth-gate').classList.contains('hidden')).toBe(true);
        expect(JSON.parse(sessionStorage.getItem('rnk-genysys-auth-session'))).toMatchObject({ token: 'grant-token' });
    });

    test('heartbeat errors relock the gate and clear the published session', async () => {
        const tauri = stubTauri({ invoke: (cmd) => {
            if (cmd === 'cmd_gate_status') return { hold: false, mode: 'command' };
            if (cmd === 'command_exchange') return { token: 'grant-token', tier: 'commander', agentId: 'agent' };
            if (cmd === 'command_heartbeat') throw new Error('link down');
            return null;
        } });
        await loadGate(tauri);
        await submit(JSON.stringify({ grant: 'valid' }));
        jest.advanceTimersByTime(5000);
        await flush();
        expect(document.getElementById('genysys-auth-gate').classList.contains('hidden')).toBe(false);
        expect(sessionStorage.getItem('rnk-genysys-auth-session')).toBeNull();
        expect(window.genysysAuthSession).toBeUndefined();
        expect(document.getElementById('genysys-auth-error').textContent).toContain('Heartbeat link drop');
    });

    test('successful heartbeat keeps the command session open', async () => {
        const tauri = stubTauri({ invoke: (cmd) => {
            if (cmd === 'cmd_gate_status') return { hold: false, mode: 'command' };
            if (cmd === 'command_exchange') return { token: 'grant-token', tier: 'commander', agentId: 'agent' };
            if (cmd === 'command_heartbeat') return { ok: true, phase: 'open' };
            return null;
        } });
        await loadGate(tauri);
        await submit(JSON.stringify({ grant: 'valid' }));
        jest.advanceTimersByTime(5000);
        await flush();
        expect(document.getElementById('genysys-auth-gate').classList.contains('hidden')).toBe(true);
        expect(tauri.__invocations.map(item => item.cmd)).toContain('command_heartbeat');
    });

    test('relocks on a not-open heartbeat and clears an existing heartbeat first', async () => {
        const tauri = stubTauri({ invoke: (cmd) => {
            if (cmd === 'cmd_gate_status') return { hold: false, mode: 'command' };
            if (cmd === 'command_exchange') return { token: 'grant-token', tier: 'commander', agentId: 'agent' };
            if (cmd === 'command_heartbeat') return { ok: false, phase: 'not-open' };
            return null;
        } });
        await loadGate(tauri);
        await submit(JSON.stringify({ grant: 'first' }));
        await submit(JSON.stringify({ grant: 'second' }));
        jest.advanceTimersByTime(5000);
        await flush();
        expect(document.getElementById('genysys-auth-error').textContent).toContain('session dropped');
        expect(sessionStorage.getItem('rnk-genysys-auth-session')).toBeNull();
    });

    test('maps plain auth errors after the native resolver rejects', async () => {
        localStorage.clear();
        sessionStorage.clear();
        const tauri = stubTauri({ invoke: (cmd) => {
            if (cmd === 'auth_resolve_code') throw 'plain failure';
            return null;
        } });
        globalThis.__GENYSYS_DEV__ = undefined;
        await loadGate(tauri);
        await submit('bad-code');
        expect(document.getElementById('genysys-auth-error').textContent).toBe('Invalid access code');
    });

    test('uses all fail-closed hold guards when optional controls are absent', async () => {
        await loadGate(stubTauri({ invoke: (cmd) => {
            if (cmd === 'cmd_gate_status') return { hold: true };
            return null;
        } }), () => {
            document.getElementById('genysys-auth-submit').remove();
            document.getElementById('genysys-auth-input').remove();
            document.getElementById('genysys-auth-error').remove();
        });
        expect(document.getElementById('genysys-auth-gate')).not.toBeNull();
    });
});

describe('auth gate: health, controls, and DOM guards', () => {
    test('covers remote and unavailable policy states without the retired identity control', async () => {
        const tauri = stubTauri({ invoke: (cmd) => {
            if (cmd === 'check_policy_health') return { connected: true, mode: 'remote', localPolicy: false };
            return null;
        } });
        await loadGate(tauri);
        expect(document.querySelector('.genysys-auth-subtitle').textContent).toBe('Secure Access Required');
        expect(document.querySelector('.genysys-auth-legacy')).toBeNull();
    });

    test('uses window.invoke and resolves when no control bridge exists', async () => {
        const invoke = jest.fn(() => Promise.resolve());
        await loadGate({ invoke: null, event: { listen: async () => () => {} } });
        window.invoke = invoke;
        document.getElementById('minimize-btn').click();
        expect(invoke).toHaveBeenCalledWith('window_minimize');

        resetShellDom();
        resetModuleRegistry();
        delete window.invoke;
        delete window.__genysysWindowControlsBound;
        await loadGate({ invoke: null, event: { listen: async () => () => {} } }, () => {
            document.getElementById('minimize-btn').remove();
        });
        document.getElementById('maximize-btn').click();
        expect(document.getElementById('genysys-auth-gate')).not.toBeNull();
    });

    test('shows the connected remote Policy state and resumes an open session with defaults', async () => {
        const tauri = stubTauri({ invoke: (cmd) => {
            if (cmd === 'check_policy_health') return { connected: true, mode: 'remote', localPolicy: true };
            return null;
        } });
        await loadGate(tauri);
        expect(document.querySelector('.genysys-auth-subtitle').textContent).toBe('G.E.N.E.S.Y.S. ready (local + remote)');

        resetShellDom();
        resetModuleRegistry();
        delete window.__genysysWindowControlsBound;
        sessionStorage.setItem('rnk-genysys-auth-session', JSON.stringify({
            token: 'saved-token', expires: Date.now() + 60_000,
        }));
        const resumed = stubTauri({ invoke: (cmd) => {
            if (cmd === 'command_session_status') return { phase: 'open' };
            if (cmd === 'command_heartbeat') return { ok: true };
            return null;
        } });
        await loadGate(resumed);
        expect(resumed.__invocations.map(item => item.cmd)).toContain('command_session_status');
    });

    test('uses empty-session fallbacks when the resumed event payload disappears', async () => {
        const raw = JSON.stringify({ token: 'saved-token', expires: Date.now() + 60_000 });
        let reads = 0;
        const originalGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function(key) {
            if (key === 'rnk-genysys-auth-session') {
                reads += 1;
                return reads === 1 ? raw : null;
            }
            return originalGetItem.call(this, key);
        };
        const tauri = stubTauri({ invoke: (cmd) => {
            if (cmd === 'command_session_status') return { phase: 'closed' };
            return null;
        } });
        await loadGate(tauri);
        Storage.prototype.getItem = originalGetItem;
        expect(tauri.__invocations.map(item => item.cmd)).toContain('set_session');
    });

    test('handles storage access exceptions in the dev-bypass probe', async () => {
        globalThis.__GENYSYS_DEV__ = true;
        const originalGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = () => { throw new Error('storage locked'); };
        await loadGate(stubTauri());
        expect(document.getElementById('genysys-auth-gate')).not.toBeNull();
        Storage.prototype.getItem = originalGetItem;
    });

    test('returns safely when the gate or optional controls are absent', async () => {
        document.body.innerHTML = '';
        await loadGate(stubTauri());
        expect(window.__genysysAuthenticated).toBeUndefined();

        resetShellDom();
        resetModuleRegistry();
        document.querySelector('.genysys-auth-subtitle').remove();
        document.getElementById('genysys-auth-submit').remove();
        await loadGate(stubTauri());
        expect(document.getElementById('genysys-auth-gate')).not.toBeNull();
    });
});
