/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS — chrome-bindings-c coverage
 * Copyright 2026 Asgard Innovations / RNK. All Rights Reserved.
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

describe('shell: chrome-bindings-c', () => {
    test('bookmark, navigation, status, and FPS surfaces cover both states', async () => {
        await bootShell();
        window.tabManager.createTab('https://bookmark.test/');
        const bookmark = document.getElementById('bookmark-btn');

        bookmark.click();
        expect(window.bookmarkManager.isBookmarked('https://bookmark.test/')).toBe(true);
        window.updateBookmarkButton();
        bookmark.click();
        expect(window.bookmarkManager.isBookmarked('https://bookmark.test/')).toBe(false);

        const navigate = jest.spyOn(window.tabManager, 'navigateActiveTab').mockImplementation(() => { });
        window.navigateToUrl('https://next.test/');
        expect(navigate).toHaveBeenCalledWith('https://next.test/');
        expect(document.getElementById('omnibox').value).toBe('https://next.test/');
        window.tabManager.tabs = [];
        window.updateBookmarkButton();
        bookmark.click();
        expect(() => window.navigateToUrl('https://without-tab.test/')).not.toThrow();

        window.setGENYSYSStatusIndicator(true);
        expect(document.getElementById('genysys-status').classList.contains('connected')).toBe(true);
        window.setGENYSYSStatusIndicator(false);
        window.setGENYSYSStatusIndicator(false, 'purple');
        expect(document.getElementById('genysys-status').classList.contains('connected')).toBe(false);
        document.getElementById('genysys-status').remove();
        document.getElementById('perf-genysys').remove();
        window.setGENYSYSStatusIndicator(false);

        window.requestAnimationFrame = jest.fn();
        window.frameCount = 0;
        window.lastTime = performance.now() - 1001;
        window.updateFPS();
        expect(document.getElementById('fps-counter')).not.toBeNull();
        window.lastTime = performance.now();
        window.updateFPS();
        expect(window.requestAnimationFrame).toHaveBeenCalled();
    });

    test('keyboard shortcuts drive browser, session, settings, and runtime actions', async () => {
        await bootShell();
        const manager = window.tabManager;
        manager.tabs = [{ id: 1, url: 'https://one.test/' }, { id: 2, url: 'https://two.test/' }];
        manager.activeTabId = 1;
        const create = jest.spyOn(manager, 'createTab').mockImplementation(() => { });
        const close = jest.spyOn(manager, 'closeTab').mockImplementation(() => { });
        const activate = jest.spyOn(manager, 'activateTab').mockImplementation(() => { });
        const refresh = jest.spyOn(manager, 'refresh').mockImplementation(() => { });
        const back = jest.spyOn(manager, 'goBack').mockImplementation(() => { });
        const forward = jest.spyOn(manager, 'goForward').mockImplementation(() => { });
        window.focusOmniboxAndSelectAll = jest.fn();
        window.focusTabSearch = jest.fn();
        window.toggleGENYSYSSpotlight = jest.fn();
        window.invoke = jest.fn(() => Promise.resolve());

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true, shiftKey: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5' }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'I', ctrlKey: true, shiftKey: true }));

        expect(create).toHaveBeenCalled();
        expect(close).toHaveBeenCalledWith(1);
        expect(activate).toHaveBeenCalled();
        expect(refresh).toHaveBeenCalledTimes(2);
        expect(window.focusOmniboxAndSelectAll).toHaveBeenCalled();
        expect(window.focusTabSearch).toHaveBeenCalled();
        expect(window.toggleGENYSYSSpotlight).toHaveBeenCalled();
        expect(back).toHaveBeenCalled();
        expect(forward).toHaveBeenCalled();
        expect(window.invoke).toHaveBeenCalledWith('open_devtools');

        manager.activeTabId = null;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true }));

        window.isGENYSYSCapabilityAvailable = jest.fn(() => false);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', ctrlKey: true, shiftKey: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', ctrlKey: true, shiftKey: true }));
        window.isGENYSYSCapabilityAvailable = jest.fn(() => true);
        window.recentlyClosedManager.addClosedTab({ url: 'https://closed.test/', title: 'Closed' });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', ctrlKey: true, shiftKey: true }));
        window.recentlyClosedManager.addClosedTab({ url: 'https://untitled.test/' });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', ctrlKey: true, shiftKey: true }));
        window.recentlyClosedManager.clearHistory();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', ctrlKey: true, shiftKey: true }));
        window.prompt = jest.fn(() => null);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', ctrlKey: true, shiftKey: true }));
        window.prompt = jest.fn(() => 'shortcut-session');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', ctrlKey: true, shiftKey: true }));
        delete window.toggleGENYSYSSpotlight;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });

    test('settings load/save and tab navigation cover guarded paths', async () => {
        await bootShell();
        window.openSettings();
        window.closeSettings();
        window.loadSettings();
        document.getElementById('setting-homepage').value = 'https://home.test/';
        document.getElementById('setting-theme').value = 'light';
        window.saveSettings();
        expect(window.settingsManager.get('general', 'homepage')).toBe('https://home.test/');

        document.getElementById('setting-homepage').dispatchEvent(new Event('change', { bubbles: true }));
        const tabs = [...document.querySelectorAll('.settings-tab')];
        const appearance = document.querySelector('.settings-section[data-section="appearance"]');
        tabs[1].click();
        expect(tabs[1].classList.contains('active')).toBe(true);
        tabs[1].classList.add('disabled');
        tabs[1].click();
        tabs[1].classList.remove('disabled');
        appearance.hidden = true;
        tabs[1].click();
        appearance.hidden = false;
        tabs[1].click();
        expect(appearance.classList.contains('active')).toBe(true);

        window.settingsManager.settings.performance.enableGENYSYSEngines = undefined;
        window.loadSettings();
    });

    test('runtime status transitions and optional status nodes fail safely', async () => {
        await bootShell();
        window.applyGENYSYSRuntimeStatus(true, 'Runtime online');
        expect(document.getElementById('status-text').textContent).toBe('Runtime online');
        window.applyGENYSYSRuntimeStatus(false);
        const runtime = window.genysysRuntime;
        runtime.connected = true;
        const stop = jest.spyOn(runtime, 'stop').mockImplementation(() => { runtime.connected = false; });
        document.getElementById('genysys-status').click();
        expect(stop).toHaveBeenCalled();

        runtime.connected = false;
        runtime.start = jest.fn(({ getTabs }) => {
            getTabs();
            runtime.connected = true;
            return Promise.resolve();
        });
        document.getElementById('genysys-status').click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(runtime.start).toHaveBeenCalled();

        delete window.tabManager;
        runtime.connected = false;
        document.getElementById('genysys-status').click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        document.getElementById('genysys-status').remove();
        document.getElementById('perf-genysys').remove();
        window.applyGENYSYSRuntimeStatus(false, 'No status nodes');
    });
});
