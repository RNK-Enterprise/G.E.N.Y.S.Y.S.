/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS™ — UI layer coverage (toast, loading, density core/surfaces)
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
    test('malformed persisted collapse state fails closed', async () => {
        localStorage.setItem('rnk-genysys-settings-section-collapse', 'not-json');
        await bootShell();
        expect(window.settingsSectionCollapseState).toEqual({});
    });

    test('null persisted collapse state falls back to an empty object', async () => {
        localStorage.setItem('rnk-genysys-settings-section-collapse', 'null');
        await bootShell();
        expect(window.settingsSectionCollapseState).toEqual({});
    });

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
        expect(localStorage.getItem('rnk-genysys-tab-bar-density')).toBe('compact');
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
        expect(JSON.parse(localStorage.getItem('rnk-genysys-settings-section-collapse')).general).toBe(true);

        window.toggleSettingsSection('general');
        expect(document.getElementById('settings-general-toggle').textContent).toBe('Collapse');
        expect(document.getElementById('settings-general-toggle').getAttribute('aria-expanded')).toBe('true');
        window.applySettingsSectionCollapseState();
        document.getElementById('settings-section-general')?.remove();
        document.getElementById('settings-general-toggle')?.remove();
        window.applySettingsSectionCollapseState();
    });

    test('modal + suggestion density and syncActiveButtons', async () => {
        await bootShell();
        const modalContent = document.querySelector('.modal-content');
        window.setModalDensityState('compact');
        expect(modalContent.classList.contains('compact')).toBe(true);
        window.saveModalDensityState();
        expect(localStorage.getItem('rnk-genysys-modal-density')).toBe('compact');

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
        window.syncActiveButtons('x', [[null, 'x']]);
        window.syncDensityToggleGroup('unknown', null, null, null, null, {});
        window.syncDensityToggleGroup('unknown', null, null, null, null, { roomy: 'Roomy' });
        window.syncDensityToggleGroup('unknown', null, null, null, null, { shell: 'Shell' });
        window.syncDensityToggleGroup('unknown', null, null, null, null, { compact: 'Compact' });
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
        window.applyLoadingDensityState(null);
        manager.hide();
    });

    test('density renderers tolerate missing control elements', async () => {
        await bootShell();
        ['tab-bar', 'tabs', 'tab-search', 'tab-bar-compact-toggle'].forEach((id) => {
            document.getElementById(id)?.remove();
        });
        window.applyTabBarCompactState();

        document.getElementById('omnibox-container')?.remove();
        document.querySelector('.omnibox-wrapper')?.remove();
        document.getElementById('omnibox-compact-toggle')?.remove();
        document.getElementById('omnibox-suggestions')?.remove();
        window.applyOmniboxCompactState();
        window.applySuggestionDensityState();
    });
});

describe('ui: density-core-b + density-surfaces', () => {
    test('settings panel dense state and toggle label round-trip', async () => {
        await bootShell();
        const ensureElement = (id, tag = 'button') => {
            const existing = document.getElementById(id);
            if (existing) return existing;
            const element = document.createElement(tag);
            element.id = id;
            document.body.appendChild(element);
            return element;
        };
        const shellToggle = ensureElement('shell-density-toggle');
        ensureElement('settings-shell-density-state', 'span');
        ensureElement('settings-shell-density-roomy');
        ensureElement('settings-shell-density-compact');
        ensureElement('settings-shell-density-custom');
        const panel = document.getElementById('settings-panel');
        window.setSettingsPanelDensityState('compact');
        expect(panel.classList.contains('dense')).toBe(true);
        expect(document.getElementById('settings-dense-toggle').textContent).toBe('Roomy');
        expect(localStorage.getItem('rnk-genysys-settings-panel-density')).toBe('compact');
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
        expect(shellToggle.textContent).toBe('Set Density');

        window.shellDensityState = 'compact';
        window.updateShellDensityToggleLabel();
        expect(document.getElementById('settings-shell-density-state').textContent).toBe('Compact');
        expect(document.getElementById('settings-shell-density-compact').getAttribute('aria-pressed')).toBe('true');

        window.shellDensityState = 'roomy';
        window.updateShellDensityToggleLabel();
        expect(document.getElementById('settings-shell-density-state').textContent).toBe('Roomy');
        expect(shellToggle.textContent).toBe('Compact All');
        window.shellDensityState = 'compact';
        window.updateShellDensityToggleLabel();
        expect(shellToggle.textContent).toBe('Roomy All');
        window.shellDensityState = 'custom';
        window.updateShellDensityToggleLabel();
        expect(shellToggle.textContent).toBe('Set Density');
        window.applySettingsDensityControls();
        expect(document.getElementById('settings-settings-density-shell').classList.contains('active')).toBe(true);
    });

    test('density core B renderers tolerate absent controls', async () => {
        await bootShell();
        [
            'settings-panel', 'settings-dense-toggle',
            'statusbar', 'status-text', 'statusbar-minimal-toggle',
            'titlebar', 'titlebar-compact-toggle',
            'settings-shell-density-state', 'settings-shell-density-roomy',
            'settings-shell-density-compact', 'settings-shell-density-custom',
            'shell-density-toggle',
        ].forEach((id) => document.getElementById(id)?.remove());
        document.querySelector('.window-title')?.remove();
        document.querySelector('.titlebar-left')?.remove();
        window.applySettingsDenseState();
        window.applyStatusbarMinimalState();
        window.applyTitlebarCompactState();
        window.updateShellDensityToggleLabel();

        const toggle = document.createElement('button');
        toggle.id = 'shell-density-toggle';
        document.body.append(toggle);
        window.shellDensityState = 'compact';
        window.updateShellDensityToggleLabel();
        window.shellDensityState = 'roomy';
        window.updateShellDensityToggleLabel();
        window.shellDensityState = 'custom';
        window.updateShellDensityToggleLabel();
    });

    test('density surface catalog renders and executes every control handler', async () => {
        await bootShell();
        const configs = window.settingsDensityControlConfigs;
        const matrix = document.getElementById('settings-density-matrix');
        expect(configs.length).toBe(14);
        expect(matrix.querySelectorAll('.setting-item')).toHaveLength(configs.length);

        configs.forEach(({ stateId, buttons, label }) => {
            expect(matrix.textContent).toContain(label);
            expect(document.getElementById(stateId)).not.toBeNull();
            buttons.forEach(({ id, handler }) => {
                expect(document.getElementById(id)).not.toBeNull();
                expect(() => handler()).not.toThrow();
            });
        });

        matrix.remove();
        expect(() => window.renderSettingsDensityControls()).not.toThrow();
    });

    test('density surface appliers tolerate absent optional surfaces', async () => {
        await bootShell();
        [
            'shortcuts-help',
            'shortcuts-dense-toggle',
            'toast-container',
            'performance-panel',
            'search-provider-modal',
            'bookmarks-bar',
        ].forEach((id) => document.getElementById(id)?.remove());

        expect(() => window.applyShortcutsDenseState()).not.toThrow();
        expect(() => window.applyToastDensityState()).not.toThrow();
        expect(() => window.applyPerformancePanelDensityState()).not.toThrow();
        expect(() => window.applySearchProviderDensityState()).not.toThrow();
        expect(() => window.applySessionsDensityState()).not.toThrow();
        expect(() => window.applyBookmarksBarDensityState()).not.toThrow();
        expect(() => window.applyBookmarksBarVisibilityState()).not.toThrow();
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
            ['setToastDensityState', 'toast-container', 'compact', 'rnk-genysys-toast-density'],
            ['setSearchProviderDensityState', null, 'roomy', 'rnk-genysys-search-provider-density'],
            ['setSessionsDensityState', null, 'compact', 'rnk-genysys-sessions-density'],
            ['setBookmarksBarDensityState', 'bookmarks-bar', 'roomy', 'rnk-genysys-bookmarks-bar-density'],
            ['setShortcutsDensityState', 'shortcuts-help', 'compact', 'rnk-genysys-shortcuts-density'],
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
        expect(localStorage.getItem('rnk-genysys-shell-density')).toBe('compact');

        window.titlebarDensityState = 'roomy';
        window.syncShellDensityStateFromSurfaces();
        expect(window.shellDensityState).toBe('custom');
    });
});
