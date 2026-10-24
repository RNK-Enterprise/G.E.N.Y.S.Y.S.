/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS™ — tab manager coverage (core + extras)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import {
    bootShell,
    resetShellDom,
    resetModuleRegistry,
    quietLogs,
    drainListeners,
    stubTauri,
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

function allowPolicy(url) {
    return { decision: 'allow', reason: 'policy_ok', audit: true, notify: false, chain: false, domain: url, source: 'local' };
}

describe('browser: tab-manager core', () => {
    test('createTab newtab auto-activates; external URL routes through POLICY', async () => {
        const tauri = stubTauri({ invoke: (cmd) => (cmd === 'navigate_tab' ? allowPolicy('https://ok.test/page') : null) });
        await bootShell({ tauri });
        const tab = window.tabManager.createTab();
        expect(tab.url).toBe('genysys://newtab');
        expect(window.tabManager.activeTabId).toBe(tab.id);
        expect(tauri.__invocations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                cmd: 'navigate_tab',
                args: expect.objectContaining({ tabId: tab.id, url: 'genysys://newtab' }),
            }),
        ]));

        const external = window.tabManager.createTab('ok.test/page');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(external.url).toBe('https://ok.test/page');
        expect(external.title).toBe('Loading...');
        const cmds = tauri.__invocations.map((i) => i.cmd);
        expect(cmds).toContain('navigate_tab');
        expect(cmds).toContain('tab_window_sync_rect');

        const blank = window.tabManager.createTab('about:blank');
        expect(window.tabManager.activeTabId).toBe(blank.id);
    });

    test('onPolicyAllowed refreshes state and syncs window rect', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        const tab = window.tabManager.createTab();
        window.tabManager.onPolicyAllowed(tab.id, 'https://allowed.test/');
        expect(tab.url).toBe('https://allowed.test/');
        expect(tab.title).toBe('Loading...');
        expect(document.getElementById('status-text').textContent).toContain('Loading');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(tauri.__invocations.map((i) => i.cmd)).toContain('tab_window_sync_rect');
    });

    test('onPolicyBlocked renders access-request, quarantine, and block views', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        const tab = window.tabManager.createTab();

        window.tabManager.onPolicyBlocked(tab.id, { decision: 'block', reason: 'domain_not_in_auth_list', domain: 'x.test' });
        window.tabManager.activateTab(tab.id);
        expect(tab.blockedView.view).toBe('access-request');
        expect(tab.title).toBe('Access Request');
        expect(document.getElementById('genysys-blocked-view')).not.toBeNull();
        window.tabManager.hideBlockedView();

        window.tabManager.onPolicyBlocked(tab.id, { decision: 'quarantine', quarantined: true, reason: 'malware', domain: 'y.test' });
        expect(tab.blockedView.view).toBe('quarantine');

        window.tabManager.onPolicyBlocked(tab.id, { decision: 'block', reason: 'policy_violation', domain: 'z.test' });
        expect(tab.blockedView.view).toBe('block');
        expect(window.tabManager.blockedViews.size).toBe(1);
        expect(document.getElementById('status-text').textContent).toBe('Blocked by P.R.O.T.E.C.T.S.');
    });

    test('activateTab shows the blocked view iframe; clean tabs hide it', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        const tab = window.tabManager.createTab();
        window.tabManager.onPolicyBlocked(tab.id, { decision: 'block', reason: 'r', domain: 'b.test' });
        window.tabManager.activateTab(tab.id);
        const frame = document.getElementById('genysys-blocked-view');
        expect(frame).not.toBeNull();
        expect(frame.src).toContain('/newtab.html?');

        const other = window.tabManager.createTab();
        expect(document.getElementById('genysys-blocked-view')).toBeNull();
        expect(other.id).toBeGreaterThan(tab.id);
    });

    test('onTauriNavigate and onTabMeta update tab state and omnibox', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        const tab = window.tabManager.createTab();

        window.tabManager.onTauriNavigate(tab.id, 'https://nav.test/', 'normal', false);
        expect(tab.url).toBe('https://nav.test/');
        expect(tab.blockedView).toBeNull();
        window.tabManager.onTauriNavigate(tab.id, 'genysys://newtab', 'normal', false);
        expect(document.getElementById('status-text').textContent).toBe('Viewing New Tab');

        window.tabManager.onTabMeta(tab.id, { title: 'Real Title', url: 'https://nav.test/updated' });
        expect(tab.title).toBe('Real Title');
        expect(document.getElementById('omnibox').value).toBe('https://nav.test/updated');
        expect(document.getElementById('status-text').textContent).toBe('Real Title');

        window.tabManager.onTabMeta(tab.id, { url: 'https://nav.test/changed' });
        expect(tab.url).toBe('https://nav.test/changed');

        window.tabManager.onTabMeta(tab.id, { url: 'data:text/html,hi' });
        expect(tab.url).toBe('https://nav.test/changed');

        const renderSpy = jest.spyOn(window.tabManager, 'renderTabs');
        window.tabManager.onTabMeta(tab.id, { title: 'Real Title', url: 'https://nav.test/changed' });
        expect(renderSpy).not.toHaveBeenCalled();
        renderSpy.mockRestore();

        window.tabManager.onTabMeta(999, { title: 'ghost' });
        window.tabManager.onTauriNavigate(999, 'https://ghost.test/');
    });

    test('onTabMeta ignores the native generic title for the new-tab page', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        const tab = window.tabManager.createTab();

        window.tabManager.onTabMeta(tab.id, {
            title: 'GENYSYS Tab',
            url: 'genysys://newtab',
        });

        expect(tab.title).toBe('New Tab');
    });

    test('setTabLoading and loadInternal route correctly', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        const tab = window.tabManager.createTab();
        window.tabManager.setTabLoading(tab.id, true);
        expect(tab.loading).toBe(true);
        expect(document.getElementById('status-text').textContent).toBe('Loading...');
        window.tabManager.setTabLoading(tab.id, false);
        expect(tab.loading).toBe(false);
        window.tabManager.setTabLoading(999, true);

        window.tauriInvoke = async (cmd, args) => ({ cmd, args });
        await window.tabManager.loadInternal(tab.id, 'newtab.html');
        window.tauriInvoke = undefined;
    });

    test('syncContentRect skips when no Tauri bridge exists', async () => {
        await bootShell({ tauri: { invoke: null, event: { listen: async () => () => { } } } });
        const tab = window.tabManager.createTab();
        expect(() => window.tabManager.syncContentRect(tab.id)).not.toThrow();
    });
});

describe('browser: tab-manager extras', () => {
    test('pinTab toggles and saveTabs persists to storage', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        const tab = window.tabManager.createTab();
        window.tabManager.pinTab(tab.id);
        expect(tab.pinned).toBe(true);
        const saved = JSON.parse(localStorage.getItem('rnk-genysys-tabs'));
        expect(saved.tabs[0].pinned).toBe(true);
        expect(saved.activeIndex).toBe(0);
        window.tabManager.pinTab(999);
    });

    test('restoreTabs restores from storage and is idempotent', async () => {
        const tauri = stubTauri({ invoke: (cmd) => (cmd === 'navigate_tab' ? allowPolicy('https://r.test/') : null) });
        await bootShell({ tauri });
        localStorage.setItem('rnk-genysys-tabs', JSON.stringify({
            tabs: [{ url: 'https://r.test/', title: 'R', favicon: null, pinned: true }],
            activeIndex: 0,
        }));
        expect(window.tabManager.restoreTabs()).toBe(true);
        expect(window.tabManager.tabs.length).toBe(1);
        expect(window.tabManager.tabs[0].pinned).toBe(true);
        expect(window.tabManager.restoreTabs()).toBe(true);
        expect(window.tabManager.tabs.length).toBe(1);

        localStorage.setItem('rnk-genysys-tabs', JSON.stringify({ tabs: [], activeIndex: -1 }));
        expect(window.tabManager.restoreTabs()).toBe(false);
        localStorage.setItem('rnk-genysys-tabs', 'not-json{{');
        expect(window.tabManager.restoreTabs()).toBe(false);
        localStorage.removeItem('rnk-genysys-tabs');
        expect(window.tabManager.restoreTabs()).toBe(false);
    });

    test('closeTab records recently-closed, drops view, and keeps one tab alive', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        const a = window.tabManager.createTab();
        const b = window.tabManager.createTab('https://close.test/');
        await new Promise((resolve) => setTimeout(resolve, 0));
        window.tabManager.closeTab(b.id);
        expect(window.tabManager.tabs.length).toBe(1);
        expect(window.recentlyClosedManager.getRecentlyClosed().length).toBe(1);

        const blocked = window.tabManager.createTab();
        window.tabManager.onPolicyBlocked(blocked.id, { decision: 'block', reason: 'r', domain: 'd.test' });
        window.tabManager.closeTab(blocked.id);
        expect(window.tabManager.blockedViews.has(blocked.id)).toBe(false);
        expect(document.getElementById('genysys-blocked-view')).toBeNull();

        window.tabManager.closeTab(a.id);
        expect(window.tabManager.tabs.length).toBe(1);
    });

    test('drag-and-drop reorders tabs with pinned guards', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        const a = window.tabManager.createTab();
        const b = window.tabManager.createTab();
        const c = window.tabManager.createTab();

        const dragEl = document.createElement('div');
        const dropTarget = document.createElement('div');
        const dragStartEvent = { target: dragEl, dataTransfer: { effectAllowed: '', setData: () => { } } };
        const dropEvent = (clientX) => {
            const event = new Event('drop', { bubbles: true, cancelable: true });
            event.preventDefault = () => { };
            event.stopPropagation = () => { };
            event.dataTransfer = { dropEffect: '', setData: () => { }, effectAllowed: '' };
            Object.defineProperty(event, 'clientX', { value: clientX });
            Object.defineProperty(event, 'currentTarget', { value: dropTarget });
            return event;
        };

        window.tabManager.handleDragStart(dragStartEvent, a.id);
        expect(window.tabManager.draggedTabId).toBe(a.id);
        expect(dragEl.classList.contains('dragging')).toBe(true);

        window.tabManager.handleDrop(dropEvent(-5), c.id);
        expect(window.tabManager.tabs.map((t) => t.id)).toEqual([b.id, a.id, c.id]);

        window.tabManager.handleDragEnd({ target: dragEl });
        expect(window.tabManager.draggedTabId).toBeNull();
        expect(dragEl.classList.contains('dragging')).toBe(false);

        window.tabManager.pinTab(c.id);
        window.tabManager.handleDragStart(dragStartEvent, b.id);
        window.tabManager.handleDrop(dropEvent(-5), c.id);
        expect(window.tabManager.tabs.map((t) => t.id)).toEqual([b.id, a.id, c.id]);

        window.tabManager.handleDrop(dropEvent(-5), 999);
        expect(window.tabManager.tabs.map((t) => t.id)).toEqual([b.id, a.id, c.id]);
    });

    test('context menu opens, dispatches actions, and closes', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        jest.useFakeTimers();
        const a = window.tabManager.createTab();
        const b = window.tabManager.createTab();

        window.tabManager.showTabContextMenu(a.id, 10, 20);
        const menu = document.getElementById('tab-context-menu');
        expect(menu).not.toBeNull();

        menu.querySelector('[data-action="pin"]').dispatchEvent(new Event('click', { bubbles: true }));
        expect(a.pinned).toBe(true);
        expect(document.getElementById('tab-context-menu')).toBeNull();

        window.tabManager.showTabContextMenu(b.id, 10, 20);
        document.querySelector('#tab-context-menu [data-action="duplicate"]').dispatchEvent(new Event('click', { bubbles: true }));
        expect(window.tabManager.tabs.length).toBe(3);

        window.tabManager.showTabContextMenu(window.tabManager.tabs[2].id, 10, 20);
        document.querySelector('#tab-context-menu [data-action="close"]').dispatchEvent(new Event('click', { bubbles: true }));
        expect(window.tabManager.tabs.length).toBe(2);

        window.tabManager.showTabContextMenu(b.id, 10, 20);
        document.querySelector('#tab-context-menu [data-action="close-others"]').dispatchEvent(new Event('click', { bubbles: true }));
        expect(window.tabManager.tabs.length).toBe(2);
        expect(window.tabManager.tabs[0].pinned).toBe(true);
        expect(window.tabManager.tabs[1].id).toBe(b.id);

        jest.advanceTimersByTime(10);
        jest.useRealTimers();
    });

    test('historyAction, goBack/goForward/refresh without Tauri are safe', async () => {
        await bootShell();
        window.tabManager.createTab();
        expect(() => window.tabManager.historyAction(1, 'back')).not.toThrow();
        expect(() => window.tabManager.goBack()).not.toThrow();
        expect(() => window.tabManager.goForward()).not.toThrow();
        window.tabManager.refresh();
        expect(document.getElementById('status-text').textContent).toBe('Refreshing...');
    });

    test('updateTab merges and rerenders', async () => {
        await bootShell();
        const tab = window.tabManager.createTab();
        window.tabManager.updateTab(tab.id, { title: 'Updated' });
        expect(tab.title).toBe('Updated');
    });

    test('loadFavicon sets favicon via image onload and clears on error', async () => {
        await bootShell();
        const tab = window.tabManager.createTab();
        tab.url = 'https://favicon.test/';
        let image;
        const OriginalImage = window.Image;
        window.Image = class {
            set src(v) { image = this; this.__src = v; }
            get src() { return this.__src; }
        };
        window.tabManager.loadFavicon(tab);
        image.onload();
        expect(tab.favicon).toBe('https://favicon.test/favicon.ico');
        window.tabManager.loadFavicon(tab);
        image.onerror();
        expect(tab.favicon).toBeNull();
        tab.url = '::::not-a-url';
        window.tabManager.loadFavicon(tab);
        expect(tab.favicon).toBeNull();
        window.Image = OriginalImage;
    });
});
