/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS™ — bindings coverage (chrome-bindings, chrome-bindings-b)
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

describe('shell: chrome-bindings', () => {
    test('new-tab button gated by capability creates tab and toasts', async () => {
        await bootShell();
        document.getElementById('new-tab-btn').click();
        expect(window.tabManager.tabs.length).toBe(1);
        expect(document.querySelectorAll('.toast').length).toBeGreaterThan(0);
    });

    test('capability-gated chrome actions fail closed', async () => {
        await bootShell();
        const gated = [
            'new-tab-btn',
            'recently-closed-btn',
            'sessions-btn',
            'search-provider-btn',
            'clear-history-btn',
            'fps-counter',
        ];
        const openRecentlyClosed = jest.spyOn(window, 'openRecentlyClosedView');
        const openSessions = jest.spyOn(window, 'openSessionsView');
        const openSearch = jest.spyOn(window, 'openSearchProviderModal');
        const togglePerformance = jest.spyOn(window, 'togglePerformancePanel');
        window.confirm = jest.fn(() => true);
        window.isGENYSYSCapabilityAvailable = jest.fn(() => false);

        gated.forEach((id) => document.getElementById(id).click());
        document.querySelector('#performance-panel .modal-close').click();
        document.getElementById('tab-bar-compact-toggle').click();
        document.getElementById('omnibox-compact-toggle').click();

        expect(window.tabManager.tabs).toHaveLength(0);
        expect(openRecentlyClosed).not.toHaveBeenCalled();
        expect(openSessions).not.toHaveBeenCalled();
        expect(openSearch).not.toHaveBeenCalled();
        expect(togglePerformance).not.toHaveBeenCalled();
        expect(window.confirm).not.toHaveBeenCalled();
    });

    test('allowed chrome actions open sessions, search, and performance surfaces', async () => {
        await bootShell();
        const sessions = jest.spyOn(window, 'openSessionsView');
        const search = jest.spyOn(window, 'openSearchProviderModal');
        const performance = jest.spyOn(window, 'togglePerformancePanel');
        window.isGENYSYSCapabilityAvailable = jest.fn(() => true);
        document.getElementById('sessions-btn').click();
        document.getElementById('search-provider-btn').click();
        document.getElementById('fps-counter').click();
        document.querySelector('#performance-panel .modal-close').click();
        expect(sessions).toHaveBeenCalled();
        expect(search).toHaveBeenCalled();
        expect(performance).toHaveBeenCalledTimes(2);
    });

    test('density binding setup tolerates a missing settings section toggle', async () => {
        await bootShell();
        document.getElementById('settings-advanced-toggle')?.remove();
        await import('../src/shell/chrome-bindings.js?missing-toggle');
        expect(document.getElementById('settings-advanced-toggle')).toBeNull();
    });

    test('save-session validates name, saves, and updates status', async () => {
        await bootShell();
        const input = document.getElementById('session-name-input');
        window.alert = jest.fn();
        document.getElementById('save-session-btn').click();
        expect(window.alert).toHaveBeenCalledWith('Please enter a session name');

        input.value = '  work  ';
        document.getElementById('save-session-btn').click();
        expect(input.value).toBe('');
        expect(document.getElementById('status-text').textContent).toBe('Session saved: work');
        expect(window.sessionManager.listSessions().map((s) => s.name)).toContain('work');
    });

    test('clear-history and reset-settings confirm paths run their managers', async () => {
        await bootShell();
        window.confirm = jest.fn(() => false);
        document.getElementById('clear-history-btn').click();
        expect(window.confirm).toHaveBeenCalled();

        window.confirm = jest.fn(() => true);
        window.historyManager.addEntry('https://old.test/', 'Old');
        document.getElementById('clear-history-btn').click();
        expect(window.historyManager.getRecent().length).toBe(0);
        expect(document.getElementById('status-text').textContent).toBe('Browsing history cleared');

        document.getElementById('reset-settings-btn').click();
        expect(document.getElementById('status-text').textContent).toBe('Settings reset to defaults');
        window.confirm = jest.fn(() => false);
        document.getElementById('reset-settings-btn').click();
        expect(window.confirm).toHaveBeenCalled();
    });

    test('tab search filters rows and reports no results', async () => {
        await bootShell();
        window.tabManager.createTab('https://first.test/one');
        window.tabManager.createTab('https://second.test/two');
        const orphan = document.createElement('div');
        orphan.className = 'tab';
        orphan.setAttribute('data-tab-id', '9999');
        orphan.innerHTML = '<span class="tab-title">Orphan</span>';
        document.getElementById('tabs').appendChild(orphan);
        const search = document.getElementById('tab-search');
        search.value = 'second';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        const rows = [...document.querySelectorAll('#tabs .tab')];
        const visible = rows.filter((row) => row.style.display !== 'none');
        expect(visible.length).toBe(1);

        search.value = 'zzznothing';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        expect([...document.querySelectorAll('.toast')].pop().textContent).toContain('No tabs found');
    });

    test('? toggles the shortcuts help modal', async () => {
        await bootShell();
        const modal = document.getElementById('shortcuts-help');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
        expect(modal.classList.contains('hidden')).toBe(false);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
        expect(modal.classList.contains('hidden')).toBe(true);
        modal.remove();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    });

    test('density toggles route through their window handlers', async () => {
        await bootShell();
        document.getElementById('settings-dense-toggle').click();
        expect(window.settingsPanelDensityState).toBe('compact');
        document.getElementById('settings-dense-toggle').click();
        expect(window.settingsPanelDensityState).toBe('roomy');
        document.getElementById('shortcuts-dense-toggle').click();
        expect(window.shortcutsDensityState).toBe('compact');
        document.getElementById('shortcuts-dense-toggle').click();
        expect(window.shortcutsDensityState).toBe('roomy');
        document.getElementById('statusbar-minimal-toggle').click();
        expect(window.statusbarDensityState).toBe('compact');
        document.getElementById('statusbar-minimal-toggle').click();
        expect(window.statusbarDensityState).toBe('roomy');
        document.getElementById('titlebar-compact-toggle').click();
        expect(window.titlebarDensityState).toBe('compact');
        document.getElementById('titlebar-compact-toggle').click();
        expect(window.titlebarDensityState).toBe('roomy');
        document.getElementById('omnibox-compact-toggle').click();
        expect(window.omniboxDensityState).toBe('compact');
        document.getElementById('omnibox-compact-toggle').click();
        expect(window.omniboxDensityState).toBe('roomy');
        document.getElementById('tab-bar-compact-toggle').click();
        expect(window.tabBarDensityState).toBe('compact');
        document.getElementById('tab-bar-compact-toggle').click();
        expect(window.tabBarDensityState).toBe('roomy');
        const shellToggle = document.createElement('button');
        shellToggle.id = 'shell-density-toggle';
        document.body.appendChild(shellToggle);
        window.bindDensityControlListeners();
        window.shellDensityState = 'compact';
        shellToggle.click();
        expect(window.shellDensityState).toBe('roomy');
        shellToggle.click();
        expect(window.shellDensityState).toBe('compact');
    });

    test('settings section and close stubs remain bound', async () => {
        await bootShell();
        const section = jest.spyOn(window, 'toggleSettingsSection');
        document.getElementById('settings-general-toggle').click();
        document.getElementById('close-settings').click();
        document.getElementById('menu-btn').click();
        expect(section).toHaveBeenCalledWith('general');
    });

    test('early close and open stubs are callable before full action bindings', async () => {
        await bootShell();
        delete window.closeSettings;
        delete window.openSettings;
        await import('../src/shell/chrome-bindings.js?early-stubs');
        document.getElementById('close-settings').click();
        document.getElementById('menu-btn').click();
    });

    test('download events update the status bar', async () => {
        await bootShell();
        for (const type of ['download-started', 'download-completed', 'download-paused', 'download-resumed', 'download-cancelled']) {
            window.dispatchEvent(new CustomEvent(type, { detail: { filename: 'file.bin' } }));
            expect(document.getElementById('status-text').textContent).toContain('file.bin');
        }
        window.dispatchEvent(new Event('history-updated'));
        window.dispatchEvent(new Event('bookmark-added'));
        window.dispatchEvent(new Event('bookmark-removed'));
        for (const type of ['download-started', 'download-completed', 'download-paused', 'download-resumed', 'download-cancelled']) {
            window.dispatchEvent(new CustomEvent(type));
        }
    });
});

describe('shell: chrome-bindings-b', () => {
    test('omnibox suggestion flow: history matches render, click navigates', async () => {
        await bootShell();
        window.historyManager.addEntry('https://docs.genysys.test/guide', 'GENYSYS docs');
        window.tabManager.createTab('genysys://newtab');
        const omnibox = document.getElementById('omnibox');
        omnibox.value = 'genysys';
        omnibox.dispatchEvent(new Event('input', { bubbles: true }));
        const items = document.querySelectorAll('#omnibox-suggestions .suggestion-item');
        expect(items.length).toBeGreaterThan(0);
        items[0].dispatchEvent(new Event('click', { bubbles: true }));
        expect(omnibox.value).toBe('https://docs.genysys.test/guide');
    });

    test('short query hides the dropdown; escape closes; arrow keys move selection', async () => {
        await bootShell();
        window.historyManager.addEntry('GENYSYS docs', 'https://docs.genysys.test/guide');
        const omnibox = document.getElementById('omnibox');
        const dropdown = document.getElementById('omnibox-suggestions');

        omnibox.value = 'a';
        omnibox.dispatchEvent(new Event('input', { bubbles: true }));
        expect(dropdown.classList.contains('hidden')).toBe(true);

        omnibox.value = 'genysys';
        omnibox.dispatchEvent(new Event('input', { bubbles: true }));
        expect(dropdown.classList.contains('hidden')).toBe(false);

        omnibox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(dropdown.querySelector('.suggestion-item').classList.contains('selected')).toBe(true);
        omnibox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        expect(dropdown.querySelector('.suggestion-item').classList.contains('selected')).toBe(false);
        omnibox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(dropdown.classList.contains('hidden')).toBe(true);

        omnibox.value = 'no-match';
        omnibox.dispatchEvent(new Event('input', { bubbles: true }));
        dropdown.innerHTML = '';
        omnibox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        omnibox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        omnibox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        omnibox.dispatchEvent(new KeyboardEvent('keypress', { key: 'Space', bubbles: true }));
        window.selectedSuggestionIndex = 0;
        omnibox.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        expect(dropdown.classList.contains('hidden')).toBe(true);
        expect(window.highlightMatch('plain text', 'missing')).toBe('plain text');
    });

    test('omnibox renders folder suggestions and preserves explicit protocols', async () => {
        await bootShell();
        window.bookmarkManager.getAllBookmarks = () => [{
            title: 'Folder Result',
            url: 'https://folder.test/',
            folder: 'saved',
        }];
        const omnibox = document.getElementById('omnibox');
        omnibox.value = 'folder';
        omnibox.dispatchEvent(new Event('input', { bubbles: true }));
        const item = document.querySelector('#omnibox-suggestions .suggestion-item');
        expect(item.querySelector('.suggestion-icon').textContent).toBe('DIR');
        item.dispatchEvent(new Event('mouseenter', { bubbles: true }));
        item.querySelector('.suggestion-url').textContent = '';
        item.dispatchEvent(new Event('click', { bubbles: true }));

        omnibox.value = 'https://already.test/';
        window.selectedSuggestionIndex = -1;
        omnibox.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        expect(omnibox.value).toBe('https://already.test/');
    });

    test('Enter on selected suggestion navigates; bare Enter builds search URL', async () => {
        await bootShell();
        window.historyManager.addEntry('https://docs.genysys.test/guide', 'GENYSYS docs');
        window.tabManager.createTab('genysys://newtab');
        const omnibox = document.getElementById('omnibox');

        omnibox.value = 'genysys';
        omnibox.dispatchEvent(new Event('input', { bubbles: true }));
        omnibox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        omnibox.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        expect(omnibox.value).toBe('https://docs.genysys.test/guide');

        omnibox.value = 'best privacy browser';
        window.selectedSuggestionIndex = -1;
        omnibox.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        expect(omnibox.value).toContain('duckduckgo.com/?q=');

        omnibox.value = 'example.com';
        window.selectedSuggestionIndex = -1;
        omnibox.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        expect(omnibox.value).toBe('https://example.com');
    });

    test('search provider selection persists and updates the icon button', async () => {
        const providerItem = document.createElement('div');
        providerItem.className = 'provider-item';
        providerItem.setAttribute('data-provider', 'brave');
        document.getElementById('search-provider-modal').appendChild(providerItem);
        await bootShell();
        providerItem.dispatchEvent(new Event('click', { bubbles: true }));
        expect(window.currentSearchProvider).toBe('brave');
        expect(localStorage.getItem('search-provider')).toBe('brave');
        expect(document.getElementById('search-provider-btn').textContent).toBe('B');
        expect(document.getElementById('search-provider-modal').classList.contains('hidden')).toBe(true);
    });

    test('navigation buttons route into tabManager', async () => {
        await bootShell();
        const calls = [];
        window.tabManager.goBack = () => calls.push('back');
        window.tabManager.goForward = () => calls.push('forward');
        window.tabManager.refresh = () => calls.push('refresh');
        const backBtn = document.getElementById('back-btn');
        const forwardBtn = document.getElementById('forward-btn');
        expect(backBtn.disabled).toBe(true);
        backBtn.disabled = false;
        forwardBtn.disabled = false;
        backBtn.click();
        forwardBtn.click();
        document.getElementById('refresh-btn').click();
        document.getElementById('home-btn').click();
        expect(calls).toEqual(['back', 'forward', 'refresh']);
    });

    test('recently-closed modal renders empty state and restore action', async () => {
        await bootShell();
        jest.useFakeTimers();
        document.getElementById('recently-closed-btn').click();
        expect(document.getElementById('recently-closed-list').innerHTML).toContain('No Recently Closed Tabs');

        window.recentlyClosedManager.addClosedTab({ id: 1, url: 'https://closed.test/', title: 'Closed', favicon: 'data:image/png;base64,AA' });
        window.recentlyClosedManager.addClosedTab({ id: 2, url: 'https://plain.test/', title: 'Plain' });
        window.showRecentlyClosedModal();
        const item = document.querySelector('#recently-closed-list .modal-list-item');
        expect(item).not.toBeNull();
        item.querySelector('.modal-item-action').dispatchEvent(new Event('mouseenter', { bubbles: true }));
        item.querySelector('.modal-item-action').dispatchEvent(new Event('click', { bubbles: true }));
        jest.advanceTimersByTime(300);
        document.querySelector('#recently-closed-list .action-btn').click();
        expect(document.getElementById('recently-closed-list').innerHTML).toContain('No Recently Closed Tabs');
        jest.useRealTimers();
    });

    test('modal guards and missing session loads fail closed', async () => {
        await bootShell();
        window.isGENYSYSCapabilityAvailable = jest.fn(() => false);
        expect(() => window.showRecentlyClosedModal()).not.toThrow();
        expect(() => window.showSessionsModal()).not.toThrow();

        window.isGENYSYSCapabilityAvailable = jest.fn(() => true);
        window.sessionManager.saveSession('missing', []);
        const loadSession = window.sessionManager.loadSession;
        window.sessionManager.loadSession = jest.fn(() => null);
        window.showSessionsModal();
        document.querySelector('#sessions-list .modal-item-action').click();
        window.sessionManager.loadSession = loadSession;
    });

    test('sessions modal lists, loads, and deletes sessions', async () => {
        await bootShell();
        jest.useFakeTimers();
        window.sessionManager.saveSession('alpha', [{ url: 'https://one.test/' }]);
        window.sessionManager.saveSession('beta', [{ url: 'https://two.test/' }]);
        window.sessionManager.saveSession('multi', [{ url: 'https://three.test/' }, { url: 'https://four.test/' }]);

        window.showSessionsModal();
        const items = document.querySelectorAll('#sessions-list .modal-list-item');
        expect(items.length).toBe(3);

        window.tabManager.tabs.push({ iframe: document.createElement('iframe') }, {});
        items[0].querySelector('.modal-item-action').dispatchEvent(new Event('click', { bubbles: true }));
        jest.advanceTimersByTime(1000);
        expect(window.tabManager.tabs.length).toBe(1);
        expect(window.tabManager.tabs[0].url).toBe('https://one.test/');

        const loadSession = window.sessionManager.loadSession;
        window.sessionManager.loadSession = jest.fn(() => null);
        window.showSessionsModal();
        document.querySelector('#sessions-list .modal-item-action').click();
        window.sessionManager.loadSession = loadSession;

        window.showSessionsModal();
        const multi = [...document.querySelectorAll('#sessions-list .modal-list-item')]
            .find((item) => item.textContent.includes('multi'));
        multi.querySelector('.modal-item-action').dispatchEvent(new Event('click', { bubbles: true }));
        jest.advanceTimersByTime(1000);

        window.confirm = jest.fn(() => true);
        window.showSessionsModal();
        document.querySelectorAll('#sessions-list .modal-list-item')[0]
            .querySelector('.modal-item-action.danger')
            .dispatchEvent(new Event('click', { bubbles: true }));
        expect(window.sessionManager.listSessions().map((s) => s.name)).toEqual(['beta', 'multi']);
        window.confirm = jest.fn(() => false);
        window.showSessionsModal();
        document.querySelectorAll('#sessions-list .modal-list-item')[0]
            .querySelector('.modal-item-action.danger')
            .dispatchEvent(new Event('click', { bubbles: true }));
        jest.useRealTimers();
    });

    test('modal backdrop click and .modal-close hide it', async () => {
        await bootShell();
        const modal = document.getElementById('sessions-modal');
        modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(modal.classList.contains('hidden')).toBe(true);
        window.showElement(modal);
        modal.querySelector('.modal-close').dispatchEvent(new Event('click', { bubbles: true }));
        expect(modal.classList.contains('hidden')).toBe(true);
    });
});
