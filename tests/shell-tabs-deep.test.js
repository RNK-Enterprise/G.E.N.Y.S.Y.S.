/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS - tab manager deep runtime coverage
 * Copyright (c) 2026 Asgard Innovations / RNK. All Rights Reserved.
 */

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
    bootShell,
    resetShellDom,
    resetModuleRegistry,
    quietLogs,
    drainListeners,
    stubTauri,
} from './helpers/shell-harness.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 0));

function dropEvent(clientX, element) {
    return {
        clientX,
        currentTarget: element,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
    };
}

beforeEach(() => {
    resetShellDom();
    resetModuleRegistry();
    localStorage.clear();
    window.sessionStorage.clear();
    drainListeners();
    quietLogs();
});

describe('browser: tab manager deep core paths', () => {
    test('settles policy callbacks, restore credits, metadata guards, and rect guards', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        const manager = window.tabManager;
        const first = manager.createTab();

        manager.onPolicyAllowed(first.id, 'https://allowed.test/');
        expect(first.title).toBe('Loading...');
        manager.onPolicyAllowed(999, 'https://missing.test/');

        first.title = 'Saved title';
        manager.onPolicyAllowed(first.id, 'https://saved.test/');
        expect(first.title).toBe('Saved title');

        manager.toast = { error: jest.fn() };
        manager.onPolicyBlocked(first.id, undefined);
        expect(first.blockedView).toEqual({
            view: 'block',
            reason: 'policy_violation',
            domain: 'https://saved.test/',
        });
        expect(manager.toast.error).toHaveBeenCalledWith('Blocked', 'policy_violation', 4000);
        manager.onPolicyBlocked(999, undefined);

        manager._restoreCredits.set(first.id, true);
        manager.onTauriNavigate(first.id, 'https://restored.test/');
        expect(manager._restoreCredits.has(first.id)).toBe(false);
        manager.onTauriNavigate(first.id, 'https://next.test/');
        manager.onTauriNavigate(999, 'https://missing.test/');

        manager.onTabMeta(first.id, {
            title: { toString: () => '' },
            url: '',
        });
        expect(first.title).toBe('Blocked');
        const omnibox = document.getElementById('omnibox');
        omnibox.focus();
        manager.onTabMeta(first.id, { title: 'Focused', url: 'https://focused.test/' });
        expect(omnibox.value).not.toBe('https://focused.test/');
        omnibox.blur();
        manager.onTabMeta(first.id, {});
        const inactive = manager.createTab();
        manager.activateTab(first.id);
        manager.onTabMeta(inactive.id, { title: 'Inactive' });
        manager.onTabMeta(999, {});

        manager.activeTabId = null;
        manager.syncContentRect();
        await pause();
        window.__TAURI__ = undefined;
        manager.syncContentRect(first.id);
        await pause();
        window.__TAURI__ = tauri;
        manager.webviewContainer = null;
        manager.syncContentRect(first.id);
        await pause();

        manager.webviewContainer = document.getElementById('webview-container');
        window.__TAURI__.invoke = async (cmd) => {
            if (cmd === 'tab_window_sync_rect') throw new Error('window not ready');
            return null;
        };
        manager.syncContentRect(first.id);
        await pause();
    });

    test('covers navigation, loading, and rejecting internal bridge calls', async () => {
        const tauri = stubTauri({
            invoke: async (cmd, args) => {
                if (cmd === 'navigate_tab') {
                    return { decision: 'allow', reason: 'policy_ok', domain: args.url };
                }
                return null;
            },
        });
        await bootShell({ tauri });
        const manager = window.tabManager;
        const tab = manager.createTab();
        manager._restoreCredits.set(tab.id, true);
        manager.setTabLoading(tab.id, true);
        expect(tab.loading).toBe(true);
        manager.setTabLoading(tab.id, false);
        manager.setTabLoading(999, true);

        manager.navigateActiveTab('navigate.test/page');
        await pause();
        expect(tab.url).toBe('https://navigate.test/page');
        manager.navigateTab(999, 'https://missing.test/');
        const originalNavigate = window.navigateWithLISA;
        window.navigateWithLISA = (_id, _url, _allow, block) => block({ reason: 'policy_violation', domain: 'blocked.test' });
        manager.createTab('create-block.test');
        manager.navigateTab(tab.id, 'blocked.test');
        window.navigateWithLISA = originalNavigate;

        window.tauriInvoke = () => Promise.reject(new Error('window closed'));
        await manager.loadInternal(tab.id, 'newtab.html');
        await pause();
    });
});

describe('browser: tab manager deep extras paths', () => {
    test('restores legacy data, skips broken entries, and handles invalid indexes', async () => {
        await bootShell({ tauri: stubTauri() });
        const manager = window.tabManager;
        const originalCreate = manager.createTab.bind(manager);
        const createSpy = jest.spyOn(manager, 'createTab');
        createSpy
            .mockReturnValueOnce(null)
            .mockImplementationOnce(() => { throw new Error('broken saved tab'); })
            .mockImplementation((url) => originalCreate(url));

        localStorage.setItem('rnk-axis-tabs', JSON.stringify({
            tabs: [
                { url: 'about:blank' },
                { url: 'https://broken.test/' },
                { url: 'https://restored.test/', title: 'Restored', favicon: 'https://restored.test/favicon.ico', pinned: true },
            ],
            activeIndex: 2,
        }));
        expect(manager.restoreTabs()).toBe(true);
        expect(manager.tabs).toHaveLength(1);
        expect(manager.tabs[0].title).toBe('Restored');
        expect(manager.tabs[0].favicon).toContain('/favicon.ico');
        expect(manager.tabs[0].pinned).toBe(true);
        expect(console.warn).toHaveBeenCalledWith('Tab restore: skipping broken tab', expect.any(Error));
        expect(manager.restoreTabs()).toBe(true);
        createSpy.mockRestore();

        manager.tabs.length = 0;
        localStorage.setItem('rnk-genysys-tabs', JSON.stringify({
            tabs: [{ url: 'genysys://newtab' }],
            activeIndex: -1,
        }));
        expect(manager.restoreTabs()).toBe(true);
        expect(manager.tabs[0].title).toBe('New Tab');

        manager.tabs.length = 0;
        localStorage.setItem('rnk-genysys-tabs', JSON.stringify({ tabs: 'invalid' }));
        expect(manager.restoreTabs()).toBe(false);
        expect(console.error).toHaveBeenCalledWith('Failed to restore tabs:', expect.any(Error));
    });

    test('covers drag-over/drop sides, missing targets, and active close teardown', async () => {
        await bootShell({ tauri: stubTauri() });
        const manager = window.tabManager;
        const a = manager.createTab();
        const b = manager.createTab();
        const c = manager.createTab();
        const target = document.querySelector(`[data-tab-id="${b.id}"]`);
        target.getBoundingClientRect = () => ({ left: 0, width: 100 });
        manager.draggedTabId = a.id;

        const over = (clientX, targetId = b.id) => ({
            clientX,
            currentTarget: target,
            dataTransfer: {},
            preventDefault: jest.fn(),
        });
        manager.handleDragOver(over(10), b.id);
        expect(target.classList.contains('drop-left')).toBe(true);
        manager.handleDragOver(over(90), b.id);
        expect(target.classList.contains('drop-right')).toBe(true);
        manager.handleDragOver(over(50), 999);
        manager.pinTab(c.id);
        manager.handleDragOver(over(50), c.id);
        manager.pinTab(c.id);

        manager.handleDrop(dropEvent(50, target), a.id);
        manager.handleDrop(dropEvent(50, target), 999);
        manager.pinTab(c.id);
        manager.handleDrop(dropEvent(50, target), c.id);
        manager.pinTab(c.id);
        manager.handleDrop(dropEvent(90, target), b.id);
        expect(manager.tabs.map(tab => tab.id)).toEqual([b.id, a.id, c.id]);

        manager.activateTab(a.id);
        manager.closeTab(999);
        window.__TAURI__ = { invoke: null };
        manager.closeTab(a.id);
        expect(manager.activeTabId).toBe(c.id);
        manager.activateTab(999);
    });

    test('swallows rejected native tab-window calls', async () => {
        await bootShell({ tauri: stubTauri() });
        const manager = window.tabManager;
        const first = manager.createTab();
        const second = manager.createTab();
        window.__TAURI__ = { invoke: () => Promise.resolve() };
        window.tauriInvoke = () => Promise.reject(new Error('native window closed'));

        manager.activateTab(first.id);
        manager.closeTab(second.id);
        manager.historyAction(first.id, 'back');
        await pause();
        expect(manager.tabs).toHaveLength(1);
    });

    test('covers no-container rendering, history fallback, and refusal view reuse', async () => {
        await bootShell({ tauri: stubTauri() });
        const manager = window.tabManager;
        const tab = manager.createTab();
        const tabs = document.getElementById('tabs');
        tabs.remove();
        manager.renderTabs();
        manager.updateTab(999, { title: 'missing' });

        window.__TAURI__ = { invoke: null };
        manager.historyAction(tab.id, 'back');
        manager.goBack();
        manager.goForward();
        manager.refresh();

        manager.webviewContainer = null;
        manager.renderBlockedView(null);
        manager.renderBlockedView(tab);
        tab.blockedView = { view: 'block', reason: 'reason', domain: 'block.test' };
        manager.renderBlockedView(tab);
        manager.renderBlockedView(tab);
        tab.blockedView.domain = '';
        manager.activateTab(tab.id);
        expect(document.getElementById('genysys-blocked-view')).not.toBeNull();
        manager.hideBlockedView();
        manager.hideBlockedView();
    });

    test('covers context-menu replacement, actions, and invalid menu targets', async () => {
        await bootShell({ tauri: stubTauri() });
        const manager = window.tabManager;
        const a = manager.createTab();
        const b = manager.createTab();
        const c = manager.createTab();

        expect(() => manager.showTabContextMenu(999, 1, 2)).not.toThrow();
        manager.showTabContextMenu(a.id, 1, 2);
        manager.showTabContextMenu(a.id, 3, 4);
        const menu = document.getElementById('tab-context-menu');
        expect(menu.style.left).toBe('3px');
        menu.querySelector('[data-action="pin"]').dispatchEvent(new Event('click', { bubbles: true }));
        manager.showTabContextMenu(a.id, 3, 4);
        menu.querySelector('[data-action="pin"]').dispatchEvent(new Event('click', { bubbles: true }));
        manager.handleContextMenuAction(999, 'duplicate');
        manager.handleContextMenuAction(999, 'close-right');
        manager.handleContextMenuAction(a.id, 'unknown');

        const originalBind = window.bindItemEvents;
        let capturedHandlers;
        window.bindItemEvents = (_items, handlers) => { capturedHandlers = handlers; };
        let scheduled;
        const timerSpy = jest.spyOn(globalThis, 'setTimeout').mockImplementation((callback) => {
            scheduled = callback;
            return 0;
        });
        const windowTimerSpy = jest.spyOn(window, 'setTimeout').mockImplementation((callback) => {
            scheduled = callback;
            return 0;
        });
        const listenerSpy = jest.spyOn(document, 'addEventListener');
        manager.showTabContextMenu(b.id, 5, 6);
        window.bindItemEvents = originalBind;
        capturedHandlers.click({ dataset: { action: '' } });
        expect(scheduled).toEqual(expect.any(Function));
        scheduled();
        expect(listenerSpy).toHaveBeenCalledWith('click', expect.any(Function), { once: true });
        document.dispatchEvent(new Event('click'));
        timerSpy.mockRestore();
        windowTimerSpy.mockRestore();
        listenerSpy.mockRestore();
        await pause();
        document.getElementById('tab-context-menu')?.remove();

        manager.handleContextMenuAction(b.id, 'close-right');
        expect(manager.tabs.some(tab => tab.id === c.id)).toBe(false);
        manager.handleContextMenuAction(a.id, 'close-others');
        expect(manager.tabs).toHaveLength(1);
    });

    test('renders tab controls and exercises keyboard and close bindings', async () => {
        await bootShell({ tauri: stubTauri() });
        jest.useFakeTimers();
        const manager = window.tabManager;
        const a = manager.createTab();
        const b = manager.createTab();
        const first = document.querySelector(`[data-tab-id="${a.id}"]`);
        const second = document.querySelector(`[data-tab-id="${b.id}"]`);

        first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        first.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        second.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        first.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 1, clientY: 2 }));
        const close = first.querySelector('.tab-close');
        close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        jest.advanceTimersByTime(100);
        jest.useRealTimers();
        expect(manager.tabs).toHaveLength(1);
    });
});
