/**
 * @jest-environment jsdom
 */

/**
 * VEIL™ — bindings coverage (chrome-bindings-c, section-nav, bind-helpers)
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

describe('shell: chrome-bindings-c', () => {
    test('bookmark button toggles star state for the active tab', async () => {
        await bootShell();
        window.tabManager.createTab('https://toggle.test/page');
        const btn = document.getElementById('bookmark-btn');
        btn.click();
        expect(btn.textContent).toBe('★');
        expect(window.bookmarkManager.isBookmarked('https://toggle.test/page')).toBe(true);
        btn.click();
        expect(btn.textContent).toBe('☆');
    });

    test('updateBookmarkButton reflects state without an active tab', async () => {
        await bootShell();
        window.updateBookmarkButton();
        expect(document.getElementById('bookmark-btn').textContent).toBe('☆');
    });

    test('veil-status click stops and starts the runtime with status text', async () => {
        await bootShell();
        const status = document.getElementById('veil-status');
        window.veilRuntime.connected = true;
        status.click();
        expect(window.veilRuntime.connected).toBe(false);
        expect(document.getElementById('status-text').textContent).toBe('VEIL Runtime stopped');
        window.veilRuntime.connected = false;
        await status.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(window.veilRuntime.connected).toBe(true);
        expect(document.getElementById('status-text').textContent).toBe('VEIL Runtime online');
    });

    test('keyboard shortcuts drive tab lifecycle and helpers', async () => {
        await bootShell();
        const press = (init) => document.dispatchEvent(new KeyboardEvent('keydown', init));

        press({ key: 't', ctrlKey: true, bubbles: true });
        expect(window.tabManager.tabs.length).toBe(1);
        press({ key: 'w', ctrlKey: true, bubbles: true });
        expect(window.tabManager.tabs.length).toBe(1);

        window.tabManager.createTab('https://a.test/');
        window.tabManager.createTab('https://b.test/');
        const count = window.tabManager.tabs.length;
        press({ key: 'Tab', ctrlKey: true, bubbles: true });
        press({ key: 'Tab', ctrlKey: true, shiftKey: true, bubbles: true });
        expect(window.tabManager.tabs.length).toBe(count);

        press({ key: 'r', ctrlKey: true, bubbles: true });
        expect(document.getElementById('status-text').textContent).toBe('Refreshing...');

        const omnibox = document.getElementById('omnibox');
        const selectSpy = jest.spyOn(omnibox, 'select');
        press({ key: 'l', ctrlKey: true, bubbles: true });
        expect(selectSpy).toHaveBeenCalled();

        window.tabManager.closeTab(window.tabManager.tabs[1].id);
        window.recentlyClosedManager.addClosedTab({ id: 99, url: 'https://reopen.test/', title: 'Reopen' });
        press({ key: 'T', ctrlKey: true, shiftKey: true, bubbles: true });
        expect(window.tabManager.tabs.some((t) => t.url === 'https://reopen.test/')).toBe(true);

        press({ key: 'S', ctrlKey: true, shiftKey: true, bubbles: true });
        expect(document.querySelectorAll('.toast').length).toBeGreaterThan(0);

        const searchFocus = jest.spyOn(document.getElementById('tab-search'), 'focus');
        press({ key: 'f', ctrlKey: true, bubbles: true });
        expect(searchFocus).toHaveBeenCalled();

        const backSpy = jest.spyOn(window.tabManager, 'goBack');
        const forwardSpy = jest.spyOn(window.tabManager, 'goForward');
        press({ key: 'ArrowLeft', altKey: true, bubbles: true });
        press({ key: 'ArrowRight', altKey: true, bubbles: true });
        expect(backSpy).toHaveBeenCalled();
        expect(forwardSpy).toHaveBeenCalled();

        window.openSettings();
        expect(document.getElementById('settings-panel').classList.contains('hidden')).toBe(false);
        window.closeSettings();
        expect(document.getElementById('settings-panel').classList.contains('hidden')).toBe(true);

        window.invoke = jest.fn();
        press({ key: 'I', ctrlKey: true, shiftKey: true, bubbles: true });
        expect(window.invoke).toHaveBeenCalledWith('open_devtools');

        window.toggleVEILSpotlight = jest.fn();
        press({ key: 'k', ctrlKey: true, bubbles: true });
        expect(window.toggleVEILSpotlight).toHaveBeenCalled();
    });

    test('loadSettings populates every settings input from defaults', async () => {
        await bootShell();
        window.openSettings();
        expect(document.getElementById('setting-homepage').value).toBe(window.settingsManager.getAll().general.homepage);
        expect(document.getElementById('setting-theme').value).toBe(window.settingsManager.getAll().appearance.theme);
        expect(document.getElementById('setting-block-cookies').checked).toBe(window.settingsManager.getAll().privacy.blockThirdPartyCookies);
    });

    test('saveSettings writes changed inputs back through settingsManager', async () => {
        await bootShell();
        window.openSettings();
        document.getElementById('setting-homepage').value = 'veil://home';
        document.getElementById('setting-theme').value = 'light';
        document.getElementById('setting-font-size').value = 'large';
        document.getElementById('setting-show-status-bar').checked = false;
        document.getElementById('setting-enable-animations').checked = false;
        document.getElementById('setting-block-cookies').checked = true;
        document.getElementById('setting-enable-dnt').checked = true;
        document.getElementById('setting-clear-history').checked = true;
        document.getElementById('setting-hardware-accel').checked = false;
        document.getElementById('setting-veil-engines').checked = false;
        document.getElementById('setting-preload-pages').checked = false;
        document.getElementById('setting-cache-size').value = '256';
        document.getElementById('setting-dev-tools').checked = true;
        document.getElementById('setting-experimental').checked = true;
        document.getElementById('setting-user-agent').value = 'VEILTest/1.0';
        document.getElementById('setting-show-bookmarks-bar').checked = false;
        document.getElementById('setting-search-engine').value = 'bing';
        document.getElementById('setting-new-tab').value = 'blank';

        const input = document.getElementById('setting-homepage');
        input.dispatchEvent(new Event('change', { bubbles: true }));

        const settings = window.settingsManager.getAll();
        expect(settings.general.homepage).toBe('veil://home');
        expect(settings.appearance.theme).toBe('light');
        expect(settings.appearance.fontSize).toBe('large');
        expect(settings.appearance.showStatusBar).toBe(false);
        expect(settings.appearance.enableAnimations).toBe(false);
        expect(settings.privacy.blockThirdPartyCookies).toBe(true);
        expect(settings.privacy.enableDNT).toBe(true);
        expect(settings.privacy.clearHistoryOnExit).toBe(true);
        expect(settings.performance.enableHardwareAcceleration).toBe(false);
        expect(settings.performance.enableVEILEngines).toBe(false);
        expect(settings.performance.preloadPages).toBe(false);
        expect(settings.performance.maxCacheSize).toBe(256);
        expect(settings.advanced.enableDevTools).toBe(true);
        expect(settings.advanced.enableExperimentalFeatures).toBe(true);
        expect(settings.advanced.customUserAgent).toBe('VEILTest/1.0');
        expect(settings.general.showBookmarksBar).toBe(false);
        expect(settings.general.searchEngine).toBe('bing');
        expect(settings.general.newTabBehavior).toBe('blank');
    });

    test('settings tab switching activates the matching section', async () => {
        await bootShell();
        window.openSettings();
        const appearanceTab = document.querySelector('.settings-tab[data-tab="appearance"]');
        appearanceTab.dispatchEvent(new Event('click', { bubbles: true }));
        expect(appearanceTab.classList.contains('active')).toBe(true);
        expect(document.querySelector('.settings-section[data-section="appearance"]').classList.contains('active')).toBe(true);
    });

    test('applyVEILRuntimeStatus styles indicator, perf veil, and status text', async () => {
        await bootShell();
        window.applyVEILRuntimeStatus(true, 'All good');
        expect(document.getElementById('status-text').textContent).toBe('All good');
        expect(document.getElementById('perf-veil').textContent).toBe('Connected');
        window.applyVEILRuntimeStatus(false);
        expect(document.getElementById('perf-veil').textContent).toBe('Disconnected');
        const status = document.getElementById('veil-status');
        expect(status.classList.contains('connected')).toBe(false);
        window.setVEILStatusIndicator(true);
        expect(status.classList.contains('connected')).toBe(true);
    });
});

describe('shell: section-nav + bind-helpers', () => {
    test('activateSection toggles sections and mounts server-control', async () => {
        await bootShell();
        window.activateSection('server-control');
        expect(document.getElementById('section-server-control').classList.contains('active')).toBe(true);
        expect(document.getElementById('section-browser').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('server-control-mount').innerHTML).toContain('Server Control');
        window.activateSection('browser');
        expect(document.getElementById('section-browser').classList.contains('active')).toBe(true);
    });

    test('lisa and admin sections mount their panels with tier gating', async () => {
        await bootShell();
        window.activateSection('lisa');
        expect(document.getElementById('lisa-section-mount').innerHTML).toContain('P.R.O.T.E.C.T.S.');
        window.activateSection('admin');
        expect(document.getElementById('admin-section-mount').innerHTML).toContain('Lisa authorization required');
        window.veilAuthSession = { tier: 'dev' };
        window.activateSection('admin');
        expect(document.getElementById('admin-section-mount').innerHTML).toContain('Ops Plane');
    });

    test('operations/people/comms mount RNK webview shells', async () => {
        await bootShell();
        window.activateSection('operations');
        expect(document.getElementById('rnk-webview-operations').innerHTML).toContain('raven.rnk-enterprise.us');
        window.activateSection('people');
        expect(document.getElementById('rnk-webview-people').innerHTML).toContain('raven.rnk-enterprise.us');
        window.activateSection('comms');
        expect(document.getElementById('rnk-webview-comms').innerHTML).toContain('echonet.rnk-enterprise.us');
    });

    test('section-nav click routing and the veil:section-changed event', async () => {
        await bootShell();
        const events = [];
        document.addEventListener('veil:section-changed', (e) => events.push(e.detail.sectionId));
        const btn = document.querySelector('.section-nav-btn[data-section="server-control"]');
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(window.activeSection).toBe('server-control');
        expect(events).toContain('server-control');
        window.activateSection('browser');
    });

    test('window controls bind once and invoke tauri commands', async () => {
        const tauri = stubTauri();
        await bootShell({ tauri });
        await window.setupWindowControls();
        await window.setupWindowControls();
        document.getElementById('minimize-btn').click();
        document.getElementById('maximize-btn').click();
        document.getElementById('close-btn').click();
        const cmds = tauri.__invocations.map((i) => i.cmd);
        expect(cmds).toContain('window_minimize');
        expect(cmds).toContain('window_maximize');
        expect(cmds).toContain('window_close');
    });

    test('bind helpers cover guard paths and modal/tab wiring', async () => {
        await bootShell();
        window.bindClickHandlers([['does-not-exist', () => { }]]);
        expect(window.bindButtonAction(null, () => { })).toBeUndefined();
        expect(window.bindCardActionButton(null, () => { })).toBeUndefined();
        window.bindCardActionButton(document.createElement('button'), null);

        const item = document.createElement('div');
        const button = document.createElement('button');
        item.appendChild(button);
        let fired = 0;
        window.bindModalActionButton(item, 'button', () => fired++);
        button.dispatchEvent(new Event('click', { bubbles: true }));
        expect(fired).toBe(1);

        const items = [document.createElement('div'), document.createElement('div')];
        const seen = [];
        window.bindItemEvents(items, {
            click: (el, index) => seen.push(['click', index]),
            mouseenter: (el, index) => seen.push(['enter', index]),
        });
        items[1].dispatchEvent(new Event('click', { bubbles: true }));
        items[0].dispatchEvent(new Event('mouseenter', { bubbles: true }));
        expect(seen).toEqual([['click', 1], ['enter', 0]]);
    });

    test('tab element interactions wire activation, keys, context menu, drag, close', async () => {
        await bootShell();
        const tab = { id: 5, url: 'https://wire.test/', title: 'W', pinned: false };
        window.tabManager.tabs.push(tab);
        const el = document.createElement('div');
        el.innerHTML = '<button class="tab-close">×</button>';
        const calls = [];
        const manager = {
            activateTab: (id) => calls.push(['activate', id]),
            showTabContextMenu: (id, x, y) => calls.push(['menu', id, x, y]),
            closeTab: (id) => calls.push(['close', id]),
            handleDragStart: () => calls.push(['dragstart']),
            handleDragOver: () => calls.push(['dragover']),
            handleDrop: () => calls.push(['drop']),
            handleDragEnd: () => calls.push(['dragend']),
        };
        window.bindTabElementInteractions(el, tab, 0, [tab], manager);

        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(calls).toContainEqual(['activate', 5]);
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 11, clientY: 22 }));
        expect(calls).toContainEqual(['menu', 5, 11, 22]);
        el.dispatchEvent(new Event('dragstart', { bubbles: true }));
        el.dispatchEvent(new Event('dragover', { bubbles: true }));
        el.dispatchEvent(new Event('drop', { bubbles: true }));
        el.dispatchEvent(new Event('dragend', { bubbles: true }));
        expect(calls).toContainEqual(['dragstart']);
        expect(calls).toContainEqual(['drop']);

        const closeEvent = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(closeEvent, 'target', { value: el.querySelector('.tab-close') });
        el.querySelector('.tab-close').dispatchEvent(closeEvent);
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(calls).toContainEqual(['close', 5]);
    });
});
