/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS™ — deep spotlight surface coverage
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

function setCaps(enabled = []) {
    const ids = new Set(enabled);
    window.genysysSpotlightCaps = (id) => ids.has(id);
}

function addActiveTab(tab = {}) {
    const activeTab = {
        id: 41,
        url: 'https://example.test/page',
        title: 'Example',
        ...tab,
    };
    window.tabManager.tabs.push(activeTab);
    window.tabManager.activeTabId = activeTab.id;
    return activeTab;
}

describe('shell: spotlight suggestion branches', () => {
    test('no-active suggestions cover history fallback, title fallback, and new-tab action', async () => {
        await bootShell();
        setCaps(['genysys-history', 'genysys-downloads']);
        window.historyManager.getRecent = undefined;
        window.historyManager.recent = [{ url: 'https://resume.test/', title: '' }];
        window.getGENYSYSDownloadSummary = () => ({});

        const resumed = window.getGENYSYSSpotlightSuggestions();
        expect(resumed[0].title).toBe('Resume latest page');
        expect(resumed[0].meta).toBe('https://resume.test/');
        resumed[0].action();
        expect(window.tabManager.tabs[0].url).toBe('https://resume.test/');

        window.tabManager.tabs = [];
        window.tabManager.activeTabId = null;
        setCaps([]);
        const empty = window.getGENYSYSSpotlightSuggestions();
        expect(empty).toHaveLength(1);
        expect(empty[0].title).toBe('Open a new tab');
        empty[0].action();
        expect(window.tabManager.tabs).toHaveLength(1);

        window.historyManager.recent = undefined;
        window.getGENYSYSDownloadSummary = () => undefined;
        setCaps(['genysys-history', 'genysys-downloads']);
        window.historyManager = { getRecent: undefined, recent: undefined };
        window.tabManager.tabs = [];
        window.tabManager.activeTabId = null;
        const emptyFallbacks = window.getGENYSYSSpotlightSuggestions();
        expect(emptyFallbacks).toHaveLength(1);
    });

    test('active suggestions cover every capability, bookmark state, history shortcuts, and actions', async () => {
        await bootShell();
        const active = addActiveTab({ url: 'https://workspace.test/page', title: 'Workspace' });
        setCaps([
            'genysys-history',
            'genysys-downloads',
            'genysys-bookmarks',
            'genysys-performance-stack',
            'genysys-security-stack',
            'genysys-extensions',
            'genysys-communication',
            'genysys-ai-assistant',
        ]);
        window.getGENYSYSSpotlightContext = () => 'workspace';
        window.historyManager.getRecent = () => [
            { url: 'https://recent-one.test/', title: 'Recent One' },
            { url: 'https://recent-two.test/' },
            { url: 'https://recent-three.test/', title: 'Recent Three' },
            { url: 'https://recent-four.test/', title: 'Ignored' },
        ];
        window.getGENYSYSDownloadSummary = () => ({ downloads: [1, 2] });
        navigator.clipboard = { writeText: jest.fn(async () => undefined) };
        window.updateStatusBar = jest.fn();
        window.showRecentlyClosedModal = jest.fn();
        window.openGENYSYSDownloadsSection = jest.fn();
        window.togglePerformancePanel = jest.fn();
        window.openSettings = jest.fn();
        window.openGENYSYSSettingsSection = jest.fn();
        window.openGENYSYSCommunicationSection = jest.fn();
        window.focusOmniboxOnly = jest.fn();

        const first = window.getGENYSYSSpotlightSuggestions();
        const firstTitles = first.map((item) => item.title);
        expect(firstTitles).toContain('Bookmark this page');
        expect(firstTitles).toContain('Related history');
        expect(firstTitles).toContain('Copy page URL');
        expect(firstTitles).toContain('Security surface');
        expect(firstTitles).toContain('Extensions');
        expect(firstTitles).toContain('Communications');
        expect(first.length).toBeLessThanOrEqual(12);

        for (const item of first) await item.action?.();
        expect(window.focusOmniboxOnly).toHaveBeenCalled();
        expect(window.showRecentlyClosedModal).toHaveBeenCalled();
        expect(window.openGENYSYSDownloadsSection).toHaveBeenCalled();
        expect(window.togglePerformancePanel).toHaveBeenCalled();
        expect(window.openSettings).toHaveBeenCalled();
        expect(window.openGENYSYSSettingsSection).toHaveBeenCalledWith('#settings-section-privacy');
        expect(window.openGENYSYSSettingsSection).toHaveBeenCalledWith('#settings-section-genysys');
        expect(window.openGENYSYSCommunicationSection).toHaveBeenCalled();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(active.url);
        expect(window.updateStatusBar).toHaveBeenCalledWith('Link copied');

        window.bookmarkManager.isBookmarked = () => true;
        window.bookmarkManager.getBookmark = () => ({ id: 77 });
        window.bookmarkManager.removeBookmark = jest.fn();
        const bookmarked = window.getGENYSYSSpotlightSuggestions()
            .find((item) => item.title === 'Remove bookmark');
        expect(bookmarked).toBeDefined();
        await bookmarked.action();

        window.bookmarkManager.isBookmarked = () => false;
        window.bookmarkManager.addBookmark = jest.fn();
        window.tabManager.activeTabId = active.id;
        const addBookmark = window.getGENYSYSSpotlightSuggestions()
            .find((item) => item.title === 'Bookmark this page');
        expect(addBookmark).toBeDefined();
        addBookmark.action();
        expect(window.bookmarkManager.addBookmark).toHaveBeenCalledWith(active.title, active.url);

        window.bookmarkManager.isBookmarked = () => true;
        window.bookmarkManager.getBookmark = () => undefined;
        window.bookmarkManager.removeBookmark = jest.fn();
        window.tabManager.activeTabId = active.id;
        const missingBookmark = window.getGENYSYSSpotlightSuggestions()
            .find((item) => item.title === 'Remove bookmark');
        missingBookmark.action();
        expect(window.bookmarkManager.removeBookmark).toHaveBeenCalledWith(undefined);

        window.historyManager.getRecent = () => [
            { url: 'https://recent-one.test/', title: 'Recent One' },
            { url: 'https://recent-two.test/' },
            { url: 'https://recent-three.test/', title: 'Recent Three' },
        ];
        window.getGENYSYSSpotlightContext = () => 'general';
        setCaps(['genysys-history']);
        const historyItems = window.getGENYSYSSpotlightSuggestions()
            .filter((item) => item.badge === 'History');
        expect(historyItems.map((item) => item.title)).toEqual([
            'Recently closed',
            'Recent One',
            'https://recent-two.test/',
            'Recent Three',
        ]);
        for (const item of historyItems.slice(1)) item.action();
        expect(window.tabManager.tabs.some((tab) => tab.url === 'https://recent-two.test/')).toBe(true);
    });

    test('active suggestions cover disabled capabilities, missing fields, and failed clipboard', async () => {
        await bootShell();
        addActiveTab({ url: '', title: '' });
        setCaps([]);
        delete window.getTabHost;
        delete window.getGENYSYSSpotlightContext;
        delete window.bookmarkManager;
        delete navigator.clipboard;

        const suggestions = window.getGENYSYSSpotlightSuggestions();
        expect(suggestions.map((item) => item.title)).toEqual([
            'Focus omnibox',
            'New tab',
            'Settings',
        ]);
        expect(suggestions[0].meta).toBe('Type a destination');

        window.tabManager.tabs = [];
        window.tabManager.activeTabId = null;
        addActiveTab({ url: 'https://failure.test/', title: 'Failure' });
        navigator.clipboard = { writeText: async () => { throw new Error('denied'); } };
        setCaps([]);
        const failed = window.getGENYSYSSpotlightSuggestions()
            .find((item) => item.title === 'Copy page URL');
        expect(failed).toBeDefined();
        await failed.action();
        expect(document.getElementById('status-text').textContent).toBe('Clipboard failed');

        setCaps(['genysys-downloads']);
        window.getGENYSYSDownloadSummary = () => ({});
        const emptyDownload = window.getGENYSYSSpotlightSuggestions()
            .find((item) => item.title === 'Open downloads');
        expect(emptyDownload.meta).toBe('0 items');
    });

    test('automation fallback is emitted when AI is unavailable and all gates stay bounded', async () => {
        await bootShell();
        addActiveTab({ url: 'https://automation.test/', title: 'Automation' });
        setCaps(['genysys-automation']);
        const suggestions = window.getGENYSYSSpotlightSuggestions();
        const automation = suggestions.find((item) => item.title === 'Automation / AI');
        expect(automation).toBeDefined();
        window.openGENYSYSSettingsSection = jest.fn();
        automation.action();
        expect(window.openGENYSYSSettingsSection).toHaveBeenCalledWith('#settings-section-advanced');
    });
});

describe('shell: spotlight rendering and dropdown lifecycle', () => {
    test('render escapes attributes, handles empty feeds, and supports actionless or invalid entries', async () => {
        await bootShell();
        window.getGENYSYSSpotlightSuggestions = () => [
            { title: '<title>&"\'', badge: '<badge>', meta: '<meta>&"\'', action: null },
            { title: null, badge: '', meta: '' },
        ];
        window.getActiveBrowserTab = () => null;
        window.renderGENYSYSSpotlight();
        const feed = document.getElementById('spotlight-feed');
        expect(feed.textContent).toContain('<title>&"\'');
        expect(feed.innerHTML).toContain('&lt;badge&gt;');
        expect(feed.innerHTML).toContain('•');
        expect(document.getElementById('spotlight-context-line').textContent).toContain('No active tab');
        feed.querySelector('.spotlight-item').click();

        const second = feed.querySelectorAll('.spotlight-item')[1];
        second.setAttribute('data-idx', '99');
        second.click();
        window.getGENYSYSSpotlightSuggestions = () => [];
        window.renderGENYSYSSpotlight();
        expect(feed.querySelector('.spotlight-empty').textContent).toBe('No spotlight actions');

        window.getGENYSYSSpotlightSuggestions = () => undefined;
        window.getActiveBrowserTab = () => ({ title: '', url: 'https://render.test/' });
        window.getTabHost = () => '';
        window.renderGENYSYSSpotlight();
        expect(document.getElementById('spotlight-context-line').textContent).toContain('Current tab');
        expect(feed.querySelector('.spotlight-empty').textContent).toBe('No spotlight actions');
        document.getElementById('spotlight-context-line').remove();
        window.renderGENYSYSSpotlight();
        expect(feed.querySelector('.spotlight-empty').textContent).toBe('No spotlight actions');
        document.getElementById('spotlight-feed').remove();
        expect(() => window.renderGENYSYSSpotlight()).not.toThrow();
    });

    test('open, close, filter, keyboard, outside-click, and tab refresh paths work', async () => {
        await bootShell();
        addActiveTab({ url: 'https://filter.test/', title: 'Filterable' });
        window.getGENYSYSSpotlightSuggestions = () => [
            { title: 'Filterable', meta: 'Matching', badge: 'Test', action: null },
            { title: 'Another action', meta: 'Other', badge: 'Test', action: null },
        ];
        const dropdown = document.getElementById('spotlight-dropdown');
        const search = document.getElementById('spotlight-search');
        const focusSpy = jest.spyOn(search, 'focus');

        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        document.getElementById('spotlight-btn').click();
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(dropdown.dataset.open).toBe('1');
        expect(focusSpy).toHaveBeenCalled();
        expect(document.getElementById('spotlight-btn').classList.contains('active')).toBe(true);

        search.value = 'filterable';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        const matching = [...document.querySelectorAll('.spotlight-item')]
            .find((item) => item.textContent.includes('Filterable'));
        expect(matching.classList.contains('hidden')).toBe(false);
        search.value = 'missing-query';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        expect([...document.querySelectorAll('.spotlight-item')].every((item) => item.classList.contains('hidden'))).toBe(true);
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(dropdown.dataset.open).toBe('0');

        window.toggleGENYSYSSpotlight();
        search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(dropdown.dataset.open).toBe('0');
        window.toggleGENYSYSSpotlight();
        window.toggleGENYSYSSpotlight();
        expect(dropdown.dataset.open).toBe('0');
        window.toggleGENYSYSSpotlight();
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(dropdown.dataset.open).toBe('0');
        window.toggleGENYSYSSpotlight();
        document.getElementById('spotlight-dropdown').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(dropdown.dataset.open).toBe('1');
        document.getElementById('spotlight-btn').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(dropdown.dataset.open).toBe('1');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(dropdown.dataset.open).toBe('0');

        window.toggleGENYSYSSpotlight();
        const renderSpy = jest.spyOn(window, 'renderGENYSYSSpotlight');
        window.dispatchEvent(new Event('genysys:tab-activated'));
        expect(renderSpy).toHaveBeenCalled();
        renderSpy.mockRestore();
        window.closeGENYSYSSpotlight();
        expect(dropdown.dataset.open).toBe('0');
    });

    test('missing spotlight mounts are safe and the close handler prevents events', async () => {
        await bootShell();
        const dropdown = document.getElementById('spotlight-dropdown');
        const search = document.getElementById('spotlight-search');
        const close = document.getElementById('spotlight-close');
        search.remove();
        expect(() => window.closeGENYSYSSpotlight()).not.toThrow();
        expect(() => window.toggleGENYSYSSpotlight()).not.toThrow();
        dropdown.remove();
        search.dispatchEvent(new Event('input', { bubbles: true }));
        expect(() => window.toggleGENYSYSSpotlight()).not.toThrow();
        expect(() => window.renderGENYSYSSpotlight()).not.toThrow();
        close.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        close.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    test('loading initialization, missing button, and already-bound controls are safe', async () => {
        await bootShell({ skipModules: ['./shell/spotlight-suggestions.js'] });
        const readyState = document.readyState;
        document.getElementById('spotlight-btn').remove();
        Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
        try {
            await import(new URL('../src/shell/spotlight-suggestions.js?missing-button', import.meta.url).href);
        } finally {
            Object.defineProperty(document, 'readyState', { configurable: true, value: readyState });
        }

        resetShellDom();
        const loadingReadyState = document.readyState;
        Object.defineProperty(document, 'readyState', {
            configurable: true,
            get: () => 'loading',
        });
        try {
            expect(document.readyState).toBe('loading');
            await import(new URL('../src/shell/spotlight-suggestions.js?loading-init-deep', import.meta.url).href);
            document.dispatchEvent(new Event('DOMContentLoaded'));
            document.getElementById('spotlight-btn').click();
            expect(typeof window.toggleGENYSYSSpotlight).toBe('function');
            document.getElementById('spotlight-btn').dataset.spotlightBound = '1';
            document.getElementById('spotlight-close').dataset.spotlightBound = '1';
            Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
            await import(new URL('../src/shell/spotlight-suggestions.js?already-bound-complete', import.meta.url).href);
        } finally {
            Object.defineProperty(document, 'readyState', { configurable: true, value: loadingReadyState });
        }
    });
});
