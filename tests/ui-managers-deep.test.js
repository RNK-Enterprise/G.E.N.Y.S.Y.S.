/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS - UI manager lifecycle coverage
 * Copyright (c) 2026 Asgard Innovations / RNK. All Rights Reserved.
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { LoadingManager } from '../src/ui/loading.js';
import { ToastManager } from '../src/ui/toast.js';

beforeEach(() => {
    document.body.innerHTML = '<div id="toast-container"></div>';
    delete window.applyLoadingDensityState;
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('ui: toast manager', () => {
    test('renders every type, message mode, fallback icon, and close lifecycle', () => {
        const manager = new ToastManager();
        const success = manager.success('Saved', 'Done', 0);
        const error = manager.error('Error', 'Failed', 0);
        const info = manager.info('Info', '', 0);
        const warning = manager.warning('Warning', 'Careful', 0);
        const fallback = manager.show('Other', '', 'unknown', 0);
        const defaults = manager.show('Default');

        expect(success.className).toBe('toast success');
        expect(error.querySelector('.toast-icon').textContent).toBe('✖');
        expect(info.querySelector('.toast-message')).toBeNull();
        expect(warning.querySelector('.toast-icon').textContent).toBe('⚠');
        expect(fallback.querySelector('.toast-icon').textContent).toBe('ℹ');
        expect(defaults.querySelector('.toast-icon').textContent).toBe('ℹ');
        expect(manager.toasts).toHaveLength(6);

        manager.remove(null);
        manager.remove(document.createElement('div'));
        success.querySelector('.toast-close').click();
        expect(success.classList.contains('removing')).toBe(true);
        jest.advanceTimersByTime(300);
        expect(document.getElementById('toast-container').contains(success)).toBe(false);
        expect(manager.toasts).not.toContain(success);
        jest.advanceTimersByTime(4000);
        jest.advanceTimersByTime(300);
    });

    test('handles auto-remove, missing close controls, detached nodes, and clear', () => {
        const manager = new ToastManager();
        const querySpy = jest.spyOn(window.Element.prototype, 'querySelector').mockReturnValue(null);
        const noClose = manager.show('No close', 'Message', 'info', 0);
        querySpy.mockRestore();
        expect(noClose).toBeTruthy();

        const automatic = manager.show('Auto', 'Message', 'info', 100);
        jest.advanceTimersByTime(100);
        expect(automatic.classList.contains('removing')).toBe(true);
        jest.advanceTimersByTime(300);
        expect(manager.toasts).not.toContain(automatic);

        const detached = manager.show('Detached', '', 'info', 0);
        manager.remove(detached);
        detached.remove();
        jest.advanceTimersByTime(300);
        expect(manager.toasts).not.toContain(detached);

        manager.clear();
        jest.advanceTimersByTime(300);
        expect(manager.toasts).toHaveLength(0);
    });
});

describe('ui: loading manager', () => {
    test('shows once, updates text, applies density, and hides cleanly', () => {
        const applyDensity = jest.fn();
        window.applyLoadingDensityState = applyDensity;
        const manager = new LoadingManager();
        manager.show();
        const first = manager.overlay;
        expect(first.querySelector('.loading-text').textContent).toBe('Loading...');
        expect(applyDensity).toHaveBeenCalledWith(first);
        manager.show('Ignored');
        expect(manager.overlay).toBe(first);
        manager.update('Ready');
        expect(first.querySelector('.loading-text').textContent).toBe('Ready');
        manager.update('Still ready');
        manager.hide();
        expect(manager.overlay).toBeNull();
        manager.hide();
        manager.update('No overlay');
    });

    test('handles absent density hook, missing text, and external removal', () => {
        const manager = new LoadingManager();
        manager.show('Working');
        const overlay = manager.overlay;
        overlay.remove();
        manager.hide();
        expect(manager.overlay).toBeNull();

        manager.show('Working again');
        manager.overlay = document.createElement('div');
        manager.update('No text node');
        manager.hide();
    });
});
