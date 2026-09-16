/**
 * @jest-environment jsdom
 */

/**
 * VEIL™ — UI layer coverage (toast, loading, density core/surfaces)
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

describe('ui: toast', () => {
    test('show/success/error/info/warning build toasts; icons and messages render', async () => {
        await bootShell();
        const { default: ToastManager } = await import('../src/ui/toast.js');
        const manager = new ToastManager();
        expect(manager.container).toBe(document.getElementById('toast-container'));

        manager.show('T', 'M');
        manager.success('S', 'saved', 0);
        manager.error('E', 'boom');
        manager.info('I', 'note');
        manager.warning('W', 'careful');
        const toasts = [...document.querySelectorAll('.toast')];
        expect(toasts.length).toBe(5);
        expect(toasts[0].textContent).toContain('M');
        expect(toasts[1].textContent).toContain('✓');
        expect(toasts[2].textContent).toContain('✖');
        expect(toasts[3].textContent).toContain('ℹ');
        expect(toasts[4].textContent).toContain('⚠');
    });

    test('close button and auto-remove paths remove the node', async () => {
        await bootShell();
        const { default: ToastManager } = await import('../src/ui/toast.js');
        const manager = new ToastManager();
        jest.useFakeTimers();

        const manual = manager.show('Manual', 'click me');
        manual.querySelector('.toast-close').dispatchEvent(new Event('click', { bubbles: true }));
        jest.advanceTimersByTime(300);
        expect(document.querySelectorAll('.toast').length).toBe(0);

        const auto = manager.show('Auto', 'gone soon', 'info', 1000);
        jest.advanceTimersByTime(1300);
        expect(document.querySelectorAll('.toast').length).toBe(0);

        manager.show('Persist', 'no duration', 'info', 0);
        jest.advanceTimersByTime(5000);
        expect(document.querySelectorAll('.toast').length).toBe(1);

        manager.clear();
        jest.advanceTimersByTime(400);
        expect(document.querySelectorAll('.toast').length).toBe(0);
        jest.useRealTimers();
    });

    test('remove ignores foreign nodes', async () => {
        await bootShell();
        const { default: ToastManager } = await import('../src/ui/toast.js');
        const manager = new ToastManager();
        const foreign = document.createElement('div');
        expect(() => manager.remove(foreign)).not.toThrow();
        expect(() => manager.remove(null)).not.toThrow();
    });
});

describe('ui: loading', () => {
    test('show/hide/update lifecycle with density application', async () => {
        await bootShell();
        const { default: LoadingManager } = await import('../src/ui/loading.js');
        const manager = new LoadingManager();

        manager.show('Working…');
        const overlay = document.querySelector('.loading-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.textContent).toContain('Working…');

        manager.show('Again');
        expect(document.querySelectorAll('.loading-overlay').length).toBe(1);

        manager.update('Still working');
        expect(overlay.querySelector('.loading-text').textContent).toBe('Still working');

        window.setLoadingDensityState('compact');
        expect(overlay.classList.contains('compact')).toBe(true);

        manager.hide();
        expect(document.querySelector('.loading-overlay')).toBeNull();
        manager.hide();
    });

    test('update without overlay is a no-op', async () => {
        await bootShell();
        const { default: LoadingManager } = await import('../src/ui/loading.js');
        const manager = new LoadingManager();
        expect(() => manager.update('nothing')).not.toThrow();
    });
});

describe('ui: density-core', () => {
    test('readEffectiveDensityMode honors new, legacy true/false, and fallback', async () => {
        await bootShell();
        const { readEffectiveDensityMode } = await import('../src/ui/density-core.js');
        expect(window.readEffectiveDensityMode('k-new', 'k-old')).toBe('shell');
        localStorage.setItem('k-new', 'roomy');
        expect(window.readEffectiveDensityMode('k-new', 'k-old')).toBe('roomy');
        localStorage.removeItem('k-new');
        localStorage.setItem('k-old', 'true');
        expect(window.readEffectiveDensityMode('k-new', 'k-old')).toBe('compact');
        localStorage.setItem('k-old', 'false');
        expect(window.readEffectiveDensityMode('k-new', 'k-old')).toBe('roomy');
        localStorage.removeItem('k-old');
        expect(window.readEffectiveDensityMode('k-new', 'k-old', 'compact')).toBe('compact');
    });

    test('isDensityEffectivelyCompact resolves shell-follow mode', async () => {
        await bootShell();
        window.shellDensityState = 'compact';
        expect(window.isDensityEffectivelyCompact('shell')).toBe(true);
        expect(window.isDensityEffectivelyCompact('roomy')).toBe(false);
        expect(window.isDensityEffectivelyCompact('compact')).toBe(true);
        window.shellDensityState = 'roomy';
        expect(window.isDensityEffectivelyCompact('shell')).toBe(false);
    });

    test('tab-bar density setters toggle classes and persist', async () => {
        await bootShell();
        window.setTabBarDensityState('compact');
        expect(document.getElementById('tab-bar').classList.contains('compact')).toBe(true);
        expect(document.getElementById('tabs').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('tab-search').classList.contains('hidden')).toBe(true);
        expect(localStorage.getItem('rnk-veil-tab-bar-density')).toBe('compact');
        expect(window.tabBarDensityState).toBe('compact');

        window.toggleTabBarCompact();
        expect(window.tabBarDensityState).toBe('roomy');
        expect(document.getElementById('tab-bar').classList.contains('roomy')).toBe(true);
        expect(document.getElementById('tab-bar-compact-toggle').textContent).toBe('Compact');
    });

    test('omnibox density hides chrome buttons and syncs group', async () => {
        await bootShell();
        window.setOmniboxDensityState('compact');
        expect(document.getElementById('omnibox-container').classList.contains('compact')).toBe(true);
        expect(document.getElementById('search-provider-btn').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('menu-btn').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('omnibox-compact-toggle').textContent).toBe('Expand');
        expect(window.omniboxDensityState).toBe('compact');
        window.toggleOmniboxCompact();
        expect(window.omniboxDensityState).toBe('roomy');
    });

    test('statusbar minimal and titlebar compact setters', async () => {
        await bootShell();
        window.setStatusbarDensityState('compact');
        expect(document.getElementById('statusbar').classList.contains('minimal')).toBe(true);
        expect(document.getElementById('status-text').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('statusbar-minimal-toggle').textContent).toBe('Full');
        window.toggleStatusbarMinimal();
        expect(window.statusbarDensityState).toBe('roomy');

        window.setTitlebarDensityState('compact');
        expect(document.getElementById('titlebar').classList.contains('compact')).toBe(true);
        expect(document.querySelector('.window-title').classList.contains('hidden')).toBe(true);
        expect(document.querySelector('.titlebar-left').classList.contains('compact')).toBe(true);
        expect(document.getElementById('titlebar-compact-toggle').textContent).toBe('Full');
        window.toggleTitlebarCompact();
        expect(window.titlebarDensityState).toBe('roomy');
    });

    test('settings section collapse toggles persist per key', async () => {
        await bootShell();
        window.toggleSettingsSection('general');
        expect(document.getElementById('settings-section-general').classList.contains('collapsed')).toBe(true);
        expect(document.getElementById('settings-general-toggle').textContent).toBe('Expand');
        expect(window.isSettingsSectionCollapsed('general')).toBe(true);
        expect(JSON.parse(localStorage.getItem('rnk-veil-settings-section-collapse')).general).toBe(true);

        window.toggleSettingsSection('general');
        expect(document.getElementById('settings-general-toggle').textContent).toBe('Collapse');
        expect(document.getElementById('settings-general-toggle').getAttribute('aria-expanded')).toBe('true');
        window.applySettingsSectionCollapseState();
    });

    test('modal + suggestion density and syncActiveButtons', async () => {
        await bootShell();
        const modalContent = document.querySelector('.modal-content');
        window.setModalDensityState('compact');
        expect(modalContent.classList.contains('compact')).toBe(true);
        window.saveModalDensityState();
        expect(localStorage.getItem('rnk-veil-modal-density')).toBe('compact');

        const dropdown = document.getElementById('omnibox-suggestions');
        window.applySuggestionDensityState();
        expect(dropdown.classList.contains('compact')).toBe(false);
        window.shellDensityState = 'compact';
        window.applySuggestionDensityState();
        expect(dropdown.classList.contains('compact')).toBe(true);

        const a = document.createElement('button');
        const b = document.createElement('button');
        window.syncActiveButtons('x', [[a, 'x'], [b, 'y']]);
        expect(a.classList.contains('active')).toBe(true);
        expect(b.classList.contains('active')).toBe(false);
        window.saveSettingsSectionCollapseState();
    });

    test('applyLoadingDensityState follows shell and direct modes', async () => {
        await bootShell();
        const { default: LoadingManager } = await import('../src/ui/loading.js');
        const manager = new LoadingManager();
        manager.show('load');
        const overlay = document.querySelector('.loading-overlay');

        window.setLoadingDensityState('roomy');
        expect(overlay.classList.contains('roomy')).toBe(true);
        window.setLoadingDensityState('shell');
        window.shellDensityState = 'compact';
        window.applyLoadingDensityState();
        expect(overlay.classList.contains('compact')).toBe(true);
        window.saveLoadingDensityState();
        manager.hide();
    });
});

describe('ui: density-core-b + density-surfaces', () => {
    test('settings panel dense state and toggle label round-trip', async () => {
        await bootShell();
        const panel = document.getElementById('settings-panel');
        window.setSettingsPanelDensityState('compact');
        expect(panel.classList.contains('dense')).toBe(true);
        expect(document.getElementById('settings-dense-toggle').textContent).toBe('Roomy');
        expect(localStorage.getItem('rnk-veil-settings-panel-density')).toBe('compact');
        window.toggleSettingsDense();
        expect(window.settingsPanelDensityState).toBe('roomy');
        expect(panel.classList.contains('roomy')).toBe(true);

        window.setSettingsPanelDensityState('shell');
        window.updateShellDensityToggleLabel();
        expect(document.getElementById('settings-shell-density-state').textContent).toBe('Roomy');

        window.shellDensityState = 'custom';
        window.updateShellDensityToggleLabel();
        expect(document.getElementById('settings-shell-density-state').textContent).toBe('Custom');
        expect(document.getElementById('settings-shell-density-custom').getAttribute('aria-pressed')).toBe('true');
        expect(document.getElementById('shell-density-toggle')).toBeNull();

        window.shellDensityState = 'compact';
        window.updateShellDensityToggleLabel();
        expect(document.getElementById('settings-shell-density-state').textContent).toBe('Compact');
        expect(document.getElementById('settings-shell-density-compact').getAttribute('aria-pressed')).toBe('true');

        window.shellDensityState = 'roomy';
        window.updateShellDensityToggleLabel();
        expect(document.getElementById('settings-shell-density-state').textContent).toBe('Roomy');
        window.applySettingsDensityControls();
        expect(document.getElementById('settings-settings-density-shell').classList.contains('active')).toBe(true);
    });

    test('toggleShellDensity flips roomy<->compact across surfaces', async () => {
        await bootShell();
        window.toggleShellDensity();
        expect(window.shellDensityState).toBe('compact');
        expect(document.getElementById('settings-shell-density-state').textContent).toBe('Compact');
        window.toggleShellDensity();
        expect(window.shellDensityState).toBe('roomy');

        window.setShellDensityState('custom');
        expect(window.shellDensityState).toBe('custom');
        expect(window.settingsPanelDensityState).toBe('roomy');
        expect(window.statusbarDensityState).toBe('roomy');
    });

    test('per-surface density setters each persist and apply', async () => {
        await bootShell();
        const cases = [
            ['setToastDensityState', 'toast-container', 'compact', 'rnk-veil-toast-density'],
            ['setSearchProviderDensityState', null, 'roomy', 'rnk-veil-search-provider-density'],
            ['setSessionsDensityState', null, 'compact', 'rnk-veil-sessions-density'],
            ['setBookmarksBarDensityState', 'bookmarks-bar', 'roomy', 'rnk-veil-bookmarks-bar-density'],
            ['setShortcutsDensityState', 'shortcuts-help', 'compact', 'rnk-veil-shortcuts-density'],
        ];
        for (const [fnName, targetId, mode, storageKey] of cases) {
            window[fnName](mode);
            expect(localStorage.getItem(storageKey)).toBe(mode);
            if (targetId) {
                const el = document.getElementById(targetId);
                const cls = fnName === 'setShortcutsDensityState' ? 'dense' : 'compact';
                expect(el.classList.contains(mode === 'compact' ? cls : 'roomy')).toBe(true);
            }
        }
        window.setPerformancePanelDensityState('compact');
        expect(document.getElementById('performance-panel').classList.contains('compact')).toBe(true);
        window.toggleShortcutsDense();
        expect(window.shortcutsDensityState).toBe('roomy');
        expect(window.isShortcutsEffectivelyDense()).toBe(false);
        window.applyBookmarksBarDensityState();
        window.applyBookmarksBarVisibilityState();
        window.applyShortcutsDenseState();
    });

    test('syncShellDensityStateFromSurfaces derives custom/compact/roomy', async () => {
        await bootShell();
        window.titlebarDensityState = 'compact';
        window.tabBarDensityState = 'compact';
        window.omniboxDensityState = 'compact';
        window.settingsPanelDensityState = 'compact';
        window.statusbarDensityState = 'compact';
        window.syncShellDensityStateFromSurfaces();
        expect(window.shellDensityState).toBe('compact');
        expect(localStorage.getItem('rnk-veil-shell-density')).toBe('compact');

        window.titlebarDensityState = 'roomy';
        window.syncShellDensityStateFromSurfaces();
        expect(window.shellDensityState).toBe('custom');
    });
});
