/** @jest-environment jsdom */

import { describe, expect, test, beforeEach } from '@jest/globals';
import { renderCamofoxStatus, refreshCamofoxStatus } from '../src/shell/camofox-status.js';

describe('Camofox status surface', () => {
    beforeEach(() => {
        document.body.innerHTML = '<span id="camofox-status" hidden></span>';
    });

    test('hides the indicator for the WebKit backend', () => {
        renderCamofoxStatus({ configuredBackend: 'webkit', backendStatus: null });
        const node = document.getElementById('camofox-status');
        expect(node.hidden).toBe(true);
        expect(node.textContent).toBe('Camofox: not selected');
    });

    test('renders ready and held states with the native reason', () => {
        const node = document.getElementById('camofox-status');
        renderCamofoxStatus({ configuredBackend: 'camofox', backendStatus: { ready: true } });
        expect(node.hidden).toBe(false);
        expect(node.classList.contains('connected')).toBe(true);
        expect(node.textContent).toBe('Camofox: Ready');

        renderCamofoxStatus({
            configuredBackend: 'camofox',
            backendStatus: { ready: false, vnc: { error: 'camofox_vnc_unavailable' } },
        });
        expect(node.classList.contains('connected')).toBe(false);
        expect(node.textContent).toContain('camofox_vnc_unavailable');

        renderCamofoxStatus({
            configuredBackend: 'camofox',
            backendStatus: { ready: false, service: { error: 'camofox_not_ready' } },
        });
        expect(node.textContent).toContain('camofox_not_ready');

        renderCamofoxStatus({ configuredBackend: 'camofox', backendStatus: { ready: false } });
        expect(node.textContent).toContain('camofox_not_ready');
    });

    test('refreshes through the existing tab status command', async () => {
        const invoke = async (command) => {
            expect(command).toBe('tab_window_status');
            return { configuredBackend: 'camofox', backendStatus: { ready: true } };
        };
        const result = await refreshCamofoxStatus(invoke);
        expect(result.backendStatus.ready).toBe(true);
        expect(document.getElementById('camofox-status').textContent).toBe('Camofox: Ready');
    });

    test('renders a held state when status IPC fails or is absent', async () => {
        await refreshCamofoxStatus(async () => { throw new Error('ipc_down'); });
        expect(document.getElementById('camofox-status').textContent).toContain('status_unavailable');
        document.body.innerHTML = '';
        renderCamofoxStatus({ configuredBackend: 'camofox', backendStatus: { ready: true } });
        await refreshCamofoxStatus();
        document.body.innerHTML = '<span id="camofox-status"></span>';
        renderCamofoxStatus(null);
        expect(document.getElementById('camofox-status').hidden).toBe(true);
    });

    test('does not throw when the status mount is absent during an IPC failure', async () => {
        document.body.innerHTML = '';
        await refreshCamofoxStatus(async () => { throw new Error('ipc_down'); });
    });
});
