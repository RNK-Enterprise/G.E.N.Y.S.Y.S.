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
    });

    test('tab search filters rows and reports no results', async () => {
        await bootShell();
        window.tabManager.createTab('https://first.test/one');
        window.tabManager.createTab('https://second.test/two');
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
    });

    test('density toggles route through their window handlers', async () => {
        await bootShell();
        document.getElementById('settings-dense-toggle').click();
        expect(window.settingsPanelDensityState).toBe('compact');
        document.getElementById('shortcuts-dense-toggle').click();
        expect(window.shortcutsDensityState).toBe('compact');
        document.getElementById('statusbar-minimal-toggle').click();
        expect(window.statusbarDensityState).toBe('compact');
        document.getElementById('titlebar-compact-toggle').click();
        expect(window.titlebarDensityState).toBe('compact');
        document.getElementById('omnibox-compact-toggle').click();
        expect(window.omniboxDensityState).toBe('compact');
        document.getElementById('tab-bar-compact-toggle').click();
        expect(window.tabBarDensityState).toBe('compact');
    });

    test('download events update the status bar', async () => {
        await bootShell();
        for (const type of ['download-started', 'download-completed', 'download-paused', 'download-resumed', 'download-cancelled']) {
            window.dispatchEvent(new CustomEvent(type, { detail: { filename: 'file.bin' } }));
            expect(document.getElementById('status-text').textContent).toContain('file.bin');
        }
        window.dispatchEvent(new Event('history-updated'));
        window.dispatchEvent(new Event('bookmark-added'));
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
        await bootShell();
        const providerItem = document.createElement('div');
        providerItem.className = 'provider-item';
        providerItem.setAttribute('data-provider', 'brave');
        document.getElementById('search-provider-modal').appendChild(providerItem);
        window.bindItemEvents([providerItem], {
            click: (item) => {
                window.currentSearchProvider = item.getAttribute('data-provider');
                localStorage.setItem('search-provider', window.currentSearchProvider);
                window.updateSearchProviderIcon();
                window.closeSearchProviderModal();
            },
        });
        providerItem.dispatchEvent(new Event('click', { bubbles: true }));
        expect(window.currentSearchProvider).toBe('brave');
        expect(localStorage.getItem('search-provider')).toBe('brave');
        expect(document.getElementById('search-provider-btn').textContent).toBe('🦁');
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
        document.getElementById('recently-closed-btn').click();
        expect(document.getElementById('recently-closed-list').innerHTML).toContain('No Recently Closed Tabs');

        window.recentlyClosedManager.addClosedTab({ id: 1, url: 'https://closed.test/', title: 'Closed' });
        window.showRecentlyClosedModal();
        const item = document.querySelector('#recently-closed-list .modal-list-item');
        expect(item).not.toBeNull();
        item.querySelector('.modal-item-action').dispatchEvent(new Event('click', { bubbles: true }));
    });

    test('sessions modal lists, loads, and deletes sessions', async () => {
        await bootShell();
        jest.useFakeTimers();
        window.sessionManager.saveSession('alpha', [{ url: 'https://one.test/' }]);
        window.sessionManager.saveSession('beta', [{ url: 'https://two.test/' }]);

        window.showSessionsModal();
        const items = document.querySelectorAll('#sessions-list .modal-list-item');
        expect(items.length).toBe(2);

        items[0].querySelector('.modal-item-action').dispatchEvent(new Event('click', { bubbles: true }));
        jest.advanceTimersByTime(1000);
        expect(window.tabManager.tabs.length).toBe(1);
        expect(window.tabManager.tabs[0].url).toBe('https://one.test/');

        window.confirm = jest.fn(() => true);
        window.showSessionsModal();
        document.querySelectorAll('#sessions-list .modal-list-item')[0]
            .querySelector('.modal-item-action.danger')
            .dispatchEvent(new Event('click', { bubbles: true }));
        expect(window.sessionManager.listSessions().map((s) => s.name)).toEqual(['beta']);
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
