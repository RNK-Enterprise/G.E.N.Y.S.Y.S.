/**
 * @jest-environment jsdom
 */

/**
 * VEIL™ — app shell coverage: auth gate
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import {
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

describe('veil-auth-gate', () => {
    test('dev bypass dismisses the gate immediately', async () => {
        globalThis.__VEIL_DEV__ = true;
        localStorage.setItem('veil_dev_bypass', 'true');
        await import('../src/veil-auth-gate.js');
        const gate = document.getElementById('veil-auth-gate');
        expect(gate.classList.contains('hidden')).toBe(true);
        expect(window.__veilAuthenticated).toMatchObject({ tier: 'dev' });
        localStorage.removeItem('veil_dev_bypass');
        globalThis.__VEIL_DEV__ = undefined;
    });

    test('already-authenticated session resumes and re-dispatches the event', async () => {
        const tauri = stubTauri();
        window.__TAURI__ = tauri;
        sessionStorage.setItem('rnk-veil-auth-session', JSON.stringify({
            token: 'tok', tier: 'agent', agentId: 'a1', expires: Date.now() + 60_000,
        }));
        let authenticated = false;
        document.addEventListener('veil:authenticated', () => { authenticated = true; });
        await import('../src/veil-auth-gate.js');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(document.getElementById('veil-auth-gate').classList.contains('hidden')).toBe(true);
        expect(authenticated).toBe(true);
        expect(tauri.__invocations.map((i) => i.cmd)).toContain('command_session_status');
    });

    test('expired sessions do not count as authenticated', async () => {
        sessionStorage.setItem('rnk-veil-auth-session', JSON.stringify({
            token: 'tok', expires: Date.now() - 1000,
        }));
        await import('../src/veil-auth-gate.js');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(document.getElementById('veil-auth-gate').classList.contains('hidden')).toBe(false);
    });

    test('dev gate mode wires submit and authenticates a code', async () => {
        const tauri = stubTauri({ invoke: (cmd) => (cmd === 'auth_resolve_code' ? { token: 't', tier: 'agent', agentId: 'a' } : null) });
        window.__TAURI__ = tauri;
        await import('../src/veil-auth-gate.js');
        await new Promise((resolve) => setTimeout(resolve, 20));

        const form = document.getElementById('veil-auth-form');
        const input = document.getElementById('veil-auth-input');
        input.value = 'good-code';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(document.getElementById('veil-auth-gate').classList.contains('hidden')).toBe(true);
        expect(sessionStorage.getItem('rnk-veil-auth-session')).not.toBeNull();
    });

    test('toggle visibility flips input type; window controls invoke commands', async () => {
        const tauri = stubTauri();
        window.__TAURI__ = tauri;
        await import('../src/veil-auth-gate.js');
        await new Promise((resolve) => setTimeout(resolve, 20));
        const vis = document.getElementById('veil-auth-vis-btn');
        const input = document.getElementById('veil-auth-input');
        vis.dispatchEvent(new Event('click', { bubbles: true }));
        expect(input.type).toBe('text');
        vis.dispatchEvent(new Event('click', { bubbles: true }));
        expect(input.type).toBe('password');

        document.getElementById('minimize-btn').dispatchEvent(new Event('click', { bubbles: true }));
        document.getElementById('maximize-btn').dispatchEvent(new Event('click', { bubbles: true }));
        document.getElementById('close-btn').dispatchEvent(new Event('click', { bubbles: true }));
        const cmds = tauri.__invocations.map((i) => i.cmd);
        expect(cmds).toContain('window_minimize');
        expect(cmds).toContain('window_maximize');
        expect(cmds).toContain('window_close');
    });

    test('bad code shows the error and re-arms the submit button', async () => {
        const tauri = stubTauri({ invoke: async (cmd) => { if (cmd === 'auth_resolve_code') throw new Error('nope'); return null; } });
        window.__TAURI__ = tauri;
        await import('../src/veil-auth-gate.js');
        await new Promise((resolve) => setTimeout(resolve, 20));
        const form = document.getElementById('veil-auth-form');
        const input = document.getElementById('veil-auth-input');
        input.value = 'bad';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(document.getElementById('veil-auth-error').textContent).toBe('nope');
        expect(document.getElementById('veil-auth-submit').disabled).toBe(false);
    });

    test('empty input is ignored; mother-lisa stub reports unwired', async () => {
        await import('../src/veil-auth-gate.js');
        await new Promise((resolve) => setTimeout(resolve, 20));
        const form = document.getElementById('veil-auth-form');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(document.getElementById('veil-auth-gate').classList.contains('hidden')).toBe(false);

        const mother = document.getElementById('veil-mother-lisa-btn');
        expect(mother).not.toBeNull();
        mother.dispatchEvent(new Event('click', { bubbles: true }));
        expect(document.getElementById('veil-auth-error').textContent).toContain('not wired');
    });

    test('COMMAND hold state locks the gate fail-closed', async () => {
        window.__TAURI__ = stubTauri({ invoke: (cmd) => (cmd === 'cmd_gate_status' ? { hold: true } : null) });
        await import('../src/veil-auth-gate.js');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(document.getElementById('veil-auth-submit').disabled).toBe(true);
        expect(document.getElementById('veil-auth-input').disabled).toBe(true);
        expect(document.getElementById('veil-auth-error').textContent).toContain('FAIL-CLOSED HOLD');
    });

    test('command exchange mode mints session from a pasted grant', async () => {
        const tauri = stubTauri({ invoke: (cmd) => {
            if (cmd === 'cmd_gate_status') return { hold: false, mode: 'command' };
            if (cmd === 'command_exchange') return { token: 'grant-tok', tier: 'commander', agentId: 'cmd-1' };
            return null;
        } });
        window.__TAURI__ = tauri;
        await import('../src/veil-auth-gate.js');
        await new Promise((resolve) => setTimeout(resolve, 20));
        const form = document.getElementById('veil-auth-form');
        document.getElementById('veil-auth-input').value = JSON.stringify({ session: 'grant' });
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(document.getElementById('veil-auth-gate').classList.contains('hidden')).toBe(true);
        expect(sessionStorage.getItem('rnk-veil-auth-session')).toContain('grant-tok');
    });

    test('command exchange failures surface the correct fail-closed message', async () => {
        const tauri = stubTauri({ invoke: async (cmd) => {
            if (cmd === 'cmd_gate_status') return { hold: false, mode: 'command' };
            if (cmd === 'command_exchange') throw new Error('Resolute dark');
            return null;
        } });
        window.__TAURI__ = tauri;
        await import('../src/veil-auth-gate.js');
        await new Promise((resolve) => setTimeout(resolve, 20));
        const form = document.getElementById('veil-auth-form');
        document.getElementById('veil-auth-input').value = 'not json';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(document.getElementById('veil-auth-error').textContent).toContain('Paste the C.O.M.M.A.N.D.');

        document.getElementById('veil-auth-input').value = JSON.stringify({ session: 'x' });
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(document.getElementById('veil-auth-error').textContent).toContain('fail closed');
        expect(document.getElementById('veil-auth-submit').disabled).toBe(false);
    });

    test('heartbeat link drop re-locks the gate', async () => {
        jest.useFakeTimers();
        const tauri = stubTauri({ invoke: (cmd) => {
            if (cmd === 'cmd_gate_status') return { hold: false, mode: 'command' };
            if (cmd === 'command_exchange') return { token: 'tok', tier: 'commander', agentId: 'a' };
            if (cmd === 'command_heartbeat') return { ok: false, phase: 'not-open' };
            return null;
        } });
        window.__TAURI__ = tauri;
        await import('../src/veil-auth-gate.js');
        await Promise.resolve();

        const form = document.getElementById('veil-auth-form');
        document.getElementById('veil-auth-input').value = JSON.stringify({ session: 'grant' });
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await Promise.resolve();
        await Promise.resolve();

        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();

        const gate = document.getElementById('veil-auth-gate');
        expect(gate.classList.contains('hidden')).toBe(false);
        expect(sessionStorage.getItem('rnk-veil-auth-session')).toBeNull();
        jest.useRealTimers();
    });
});
