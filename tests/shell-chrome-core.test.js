/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS™ — chrome core coverage (actions, spotlight, capabilities, surfaces)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import {
    bootShell,
    resetShellDom,
    resetModuleRegistry,
    quietLogs,
    drainListeners,
    stableCapability,
} from './helpers/shell-harness.js';

function stopRuntime() {
    try { window.genysysRuntime?.stop(); } catch { /* not started */ }
}

beforeEach(() => {
    stopRuntime();
    resetShellDom();
    resetModuleRegistry();
    window.sessionStorage.clear();
    localStorage.clear();
    quietLogs();
    drainListeners();
});

describe('shell: chrome-actions', () => {
    test('getActiveBrowserTab/getTabHost resolve from tabManager state', async () => {
        await bootShell();
        expect(window.getActiveBrowserTab()).toBeNull();
        const tabManager = window.tabManager;
        window.tabManager = { tabs: null };
        expect(window.getActiveBrowserTab()).toBeNull();
        window.tabManager = tabManager;
        window.tabManager.tabs.push({ id: 1, url: 'https://www.example.com/x', title: 'E' });
        window.tabManager.activeTabId = 1;
        expect(window.getActiveBrowserTab().id).toBe(1);
        expect(window.getTabHost(window.getActiveBrowserTab())).toBe('example.com');
        expect(window.getTabHost({})).toBe('');
        expect(window.getTabHost({ url: '::::' })).toBe('');
    });

    test('focus helpers, modal helpers, and element visibility', async () => {
        await bootShell();
        const omnibox = document.getElementById('omnibox');
        const focusSpy = jest.spyOn(omnibox, 'focus');
        const selectSpy = jest.spyOn(omnibox, 'select');
        window.focusOmniboxOnly();
        window.focusOmniboxAndSelectAll();
        window.focusOmniboxAndMaybeSearchProvider();
        expect(focusSpy).toHaveBeenCalled();
        expect(selectSpy).toHaveBeenCalled();
        expect(document.getElementById('search-provider-modal').classList.contains('hidden')).toBe(false);

        window.setOmniboxValueAndFocus('genysys://newtab');
        expect(omnibox.value).toBe('genysys://newtab');
        window.hideModal(document.getElementById('search-provider-modal'));
        expect(document.getElementById('search-provider-modal').classList.contains('hidden')).toBe(true);
        window.hideElement('search-provider-modal');
        window.showElement('search-provider-modal');
        window.closeSearchProviderModal();
        expect(document.getElementById('search-provider-modal').classList.contains('hidden')).toBe(true);
        expect(window.setElementHidden('#nope', true)).toBeUndefined();

        window.showSessionsModal = jest.fn();
        window.showRecentlyClosedModal = jest.fn();
        window.openSessionsView();
        window.openRecentlyClosedView();
        expect(window.showSessionsModal).toHaveBeenCalled();
        expect(window.showRecentlyClosedModal).toHaveBeenCalled();

        document.getElementById('omnibox').remove();
        window.focusOmniboxAndSelectAll();
        window.setOmniboxValueAndFocus('missing');
    });

    test('openGENYSYSSettingsSection opens settings and scrolls the section', async () => {
        await bootShell();
        const scrollSpy = jest.fn();
        const section = document.querySelector('#settings-panel');
        section.scrollIntoView = scrollSpy;
        window.openGENYSYSSettingsSection('#settings-panel');
        expect(scrollSpy).toHaveBeenCalled();
        window.openGENYSYSSettingsSection();
        window.focusTabSearch();
    });

    test('togglePerformancePanel toggles through perfMonitor', async () => {
        await bootShell();
        window.togglePerformancePanel();
        expect(document.getElementById('performance-panel').classList.contains('hidden')).toBe(false);
        window.togglePerformancePanel();
        expect(document.getElementById('performance-panel').classList.contains('hidden')).toBe(true);
    });

    test('pin helper returns false without an active tab, true with one', async () => {
        await bootShell();
        expect(window.toggleActiveTabPinnedState()).toBe(false);
        window.tabManager.tabs.push({ id: 2, url: 'genysys://newtab', title: 'New Tab', pinned: false });
        window.tabManager.activeTabId = 2;
        expect(window.toggleActiveTabPinnedState()).toBe(true);
        expect(window.tabManager.tabs[0].pinned).toBe(true);
    });
});

describe('shell: spotlight-context', () => {
    test.each([
        ['github.com/x/pull/1', 'PR #1', 'dev'],
        ['github.com/rnk/genysys', 'Our repository', 'code'],
        ['docs.rust-lang.org', 'The book', 'docs'],
        ['stackoverflow.com', 'How to jsdom', 'docs'],
        ['chat.openai.com', 'Chat', 'ai'],
        ['news.ycombinator.com', 'Front page', 'news'],
        ['linear.app', 'Board', 'workspace'],
        ['automation.example.com', 'Pipelines', 'automation'],
        ['slack.com', 'General', 'comms'],
        ['127.0.0.1:1420', 'Local', 'dev'],
        ['youtube.com', 'Video', 'media'],
        ['extensions.gnome.org', 'Shells', 'extensions'],
        ['files.example.com/big.zip', 'Download', 'downloads'],
        ['google.com', 'Search', 'search'],
        ['example.org', 'Anything else', 'general'],
    ])('%p → %p', (url, title, expected) => {
        expect(window.getGENYSYSSpotlightContext(url, title, `https://${url}`)).toBe(expected);
    });
});

describe('shell: spotlight-suggestions', () => {
    test('suggests a new tab when nothing is active', async () => {
        await bootShell();
        const suggestions = window.getGENYSYSSpotlightSuggestions();
        expect(suggestions[0].title).toBe('Open a new tab');
        expect(suggestions.length).toBeGreaterThan(0);
    });

    test('resumes latest history entry when present', async () => {
        await bootShell();
        window.historyManager.addEntry('Earlier page', 'https://earlier.test/');
        const suggestions = window.getGENYSYSSpotlightSuggestions();
        expect(suggestions[0].title).toBe('Resume latest page');
        suggestions[0].action();
        expect(window.tabManager.tabs.length).toBe(1);
    });

    test('active tab surfaces nav, settings, and capability-gated actions', async () => {
        await bootShell();
        window.tabManager.tabs.push({ id: 7, url: 'https://mail.google.com/u/0', title: 'Mail' });
        window.tabManager.activeTabId = 7;
        const suggestions = window.getGENYSYSSpotlightSuggestions();
        const titles = suggestions.map((s) => s.title);
        expect(titles).toContain('Focus omnibox');
        expect(titles).toContain('New tab');
        expect(titles).toContain('Settings');
        const bookmarkEntry = suggestions.find((s) => s.title === 'Bookmark this page');
        bookmarkEntry.action();
        expect(window.bookmarkManager.isBookmarked('https://mail.google.com/u/0')).toBe(true);
    });

    test('render/toggle/filter lifecycle through the real dropdown', async () => {
        await bootShell();
        window.tabManager.tabs.push({ id: 8, url: 'https://mail.google.com', title: 'Mail' });
        window.tabManager.activeTabId = 8;
        window.toggleGENYSYSSpotlight();
        expect(document.getElementById('spotlight-dropdown').dataset.open).toBe('1');
        window.renderGENYSYSSpotlight();
        const feed = document.getElementById('spotlight-feed');
        expect(feed.querySelectorAll('.spotlight-item').length).toBeGreaterThan(0);

        const search = document.getElementById('spotlight-search');
        search.value = 'nomatchxyz';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        expect(feed.querySelector('.spotlight-item').classList.contains('hidden')).toBe(true);

        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        feed.querySelector('.spotlight-item').click();
        expect(document.getElementById('spotlight-dropdown').dataset.open).toBe('0');

        window.toggleGENYSYSSpotlight();
        document.getElementById('spotlight-close').dispatchEvent(new Event('mousedown', { bubbles: true }));
        expect(document.getElementById('spotlight-dropdown').dataset.open).toBe('0');

        window.toggleGENYSYSSpotlight();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.getElementById('spotlight-dropdown').dataset.open).toBe('0');
        window.closeGENYSYSSpotlight();
    });

    test('copy URL action reports failure through the status bar', async () => {
        await bootShell();
        navigator.clipboard = { writeText: async () => { throw new Error('denied'); } };
        window.tabManager.tabs.push({ id: 9, url: 'https://copy.test/page', title: 'C' });
        window.tabManager.activeTabId = 9;
        const suggestions = window.getGENYSYSSpotlightSuggestions();
        const copyEntry = suggestions.find((s) => s.title === 'Copy page URL');
        expect(copyEntry).toBeDefined();
        await copyEntry.action();
        expect(document.getElementById('status-text').textContent).toContain('Clipboard failed');
    });
});

describe('shell: capabilities + surfaces-core', () => {
    test('capability map lookups and chip creation', async () => {
        await bootShell();
        expect(window.getGENYSYSCapability('genysys-browser-core')).not.toBeNull();
        expect(window.isGENYSYSCapabilityAvailable('genysys-browser-core')).toBe(true);
        const chip = window.createGENYSYSChip('Cat', 'category');
        expect(chip.className).toBe('genysys-chip genysys-chip-category');
        expect(window.createGENYSYSChip('Neutral').className).toBe('genysys-chip genysys-chip-neutral');
        expect(window.getGENYSYSCapability('missing-capability')).toBeNull();
    });

    test('renderGENYSYSCapabilities populates summary, categories, surfaces, items', async () => {
        await bootShell();
        const manifest = {
            product: 'GENYSYS',
            catalog_summary: { engines: 8, turbos: 9 },
            surface_defaults: ['window'],
            capabilities: [
                { id: 'a', name: 'Alpha', category: 'browser', surface: 'window', status: 'stable', priority: 'core', description: 'first' },
                { id: 'b', name: 'Beta', category: 'security', surface: 'policy', status: 'stable', priority: 'low', description: '' },
            ],
        };
        window.renderGENYSYSCapabilities(manifest);
        expect(document.getElementById('genysys-manifest-summary').textContent).toContain('2 capabilities');
        expect(document.getElementById('genysys-category-list').children.length).toBe(2);
        expect(document.getElementById('genysys-surface-list').children.length).toBe(2);
        expect(document.getElementById('genysys-capability-list').children.length).toBe(2);
    });

    test('capability rendering handles partial catalogs and missing mounts', async () => {
        await bootShell();
        window.renderGENYSYSCapabilities({});
        window.renderGENYSYSCapabilities({
            capabilities: [
                { id: 'unknown', name: 'Unknown', priority: 'mystery', description: '' },
                { id: 'defaulted', name: 'Defaulted', category: '', surface: '', status: 'stable' },
            ],
        });
        expect(window.createGENYSYSChip('Explicit default', undefined).className)
            .toBe('genysys-chip genysys-chip-neutral');
        expect(document.getElementById('genysys-manifest-summary').textContent).toContain(
            '2 capabilities loaded from G.E.N.E.S.Y.S. (unknown engines, unknown turbos)',
        );
        expect(document.getElementById('genysys-capability-list').children).toHaveLength(2);

        document.getElementById('genysys-capability-list').remove();
        expect(() => window.renderGENYSYSCapabilities({ capabilities: [] })).not.toThrow();
    });

    test('getGENYSYSDownloadSummary partitions by status; non-downloadable URLs refuse', async () => {
        await bootShell();
        window.downloadManager.getDownloads = () => [
            { status: 'downloading' },
            { status: 'paused' },
            { status: 'completed' },
            { status: 'failed' },
        ];
        const summary = window.getGENYSYSDownloadSummary();
        expect(summary.active).toHaveLength(1);
        expect(summary.paused).toHaveLength(1);
        expect(summary.completed).toHaveLength(1);
        expect(summary.failed).toHaveLength(1);

        expect(window.startDownloadFromActiveTab()).toBe(false);
        window.tabManager.tabs.push({ id: 3, url: 'genysys://newtab', title: 'New Tab' });
        window.tabManager.activeTabId = 3;
        expect(window.startDownloadFromActiveTab()).toBe(false);
        window.tabManager.tabs[0].url = 'https://genysys.test/page';
        window.downloadManager.startDownload = () => ({ filename: 'page' });
        expect(window.startDownloadFromActiveTab()).toBe(true);
        window.tabManager.tabs[0].title = '   ';
        window.downloadManager.getFilenameFromUrl = () => 'fallback-page';
        expect(window.startDownloadFromActiveTab()).toBe(true);
        const capabilityAvailable = window.isGENYSYSCapabilityAvailable;
        window.isGENYSYSCapabilityAvailable = () => false;
        expect(window.startDownloadFromActiveTab()).toBe(false);
        window.isGENYSYSCapabilityAvailable = capabilityAvailable;
        window.tabManager.tabs[0].url = 'not a url';
        expect(window.startDownloadFromActiveTab()).toBe(false);
        const downloadManager = window.downloadManager;
        window.downloadManager = null;
        expect(window.getGENYSYSDownloadSummary()).toEqual({
            downloads: [], active: [], paused: [], completed: [], failed: [],
        });
        window.downloadManager = downloadManager;
    });

    test('theme helpers normalize and persist', async () => {
        await bootShell();
        expect(window.applyThemeState('light')).toBe('light');
        expect(document.body.dataset.theme).toBe('light');
        expect(window.applyThemeState('weird')).toBe('dark-neutral');
        expect(window.applyThemeState()).toBe('dark-neutral');
        expect(window.getThemeLabel('dark')).toBe('Dark');
        expect(window.getThemeLabel('light')).toBe('Light');
        expect(window.getThemeLabel('other')).toBe('Dark Neutral');
        document.getElementById('setting-theme')?.remove();
        expect(window.setThemeState('dark-neutral')).toBe('dark-neutral');
        expect(window.setThemeState('dark-neutral', { statusMessage: '', fromGENYSYS: false }))
            .toBe('dark-neutral');
        const select = document.createElement('select');
        select.id = 'setting-theme';
        ['dark', 'light', 'dark-neutral'].forEach((v) => {
            const opt = document.createElement('option');
            opt.value = v;
            select.appendChild(opt);
        });
        document.body.appendChild(select);
        expect(window.setThemeState('dark', { statusMessage: 'Theme set' })).toBe('dark');
        expect(select.value).toBe('dark');
        expect(document.getElementById('status-text').textContent).toBe('Theme set');
        expect(window.setThemeState('light', { fromGENYSYS: true })).toBe('light');
        expect(document.getElementById('status-text').textContent).toContain('Light');
    });

    test('search provider state falls back through storage and defaults', async () => {
        localStorage.setItem('search-provider', 'bing');
        await bootShell();
        expect(window.getSearchProviderState().id).toBe('bing');
        window.currentSearchProvider = 'duckduckgo';
        expect(window.getSearchProviderState().id).toBe('duckduckgo');
        window.currentSearchProvider = undefined;
        localStorage.clear();
        expect(window.getSearchProviderState().id).toBe('duckduckgo');
        window.currentSearchProvider = 'missing';
        window.searchProviders = {};
        expect(window.getSearchProviderState()).toEqual({ id: 'missing', name: 'missing', url: '' });
        window.searchProviders = null;
        expect(window.getSearchProviderState()).toEqual({ id: 'missing', name: 'missing', url: '' });
        expect(window.getSearchProviderLabel({})).toBe('DuckDuckGo');
        expect(window.getSearchProviderLabel({ name: 'Brave' })).toBe('Brave');
    });
});

describe('shell: sidebar-render', () => {
    test('state badge helpers set text and dataset', async () => {
        await bootShell();
        const el = document.createElement('span');
        window.setGENYSYSSidebarStateBadge(el, 'Ready', 'ready');
        expect(el.textContent).toBe('Ready');
        expect(el.dataset.state).toBe('ready');
        window.setGENYSYSSidebarStateBadge(el, 'Offline');
        expect(el.dataset.state).toBe('offline');
        window.setGENYSYSSidebarStateBadgeFromCapability(el, 'genysys-browser-core');
        expect(el.textContent).toBe('Ready');
        window.setGENYSYSSidebarStateBadgeFromCapability(el, 'no-such-capability', 'Ready', 'ready', 'Offline');
        expect(el.textContent).toBe('Offline');
        window.setGENYSYSSidebarStateBadge(null, 'Ignored');
        window.setGENYSYSSidebarStateBadgeFromCapability(null, 'ignored');
    });

    test('surface availability hides and disables per the rules', async () => {
        await bootShell();
        window.genysysRuntime.manifest = { capabilities: [] };
        window.genysysRuntime.capabilities = new Map();
        window.updateGENYSYSSurfaceAvailability(window.genysysRuntime.manifest);
        expect(document.getElementById('new-tab-btn').hidden).toBe(true);
        expect(document.getElementById('clear-history-btn').disabled).toBe(true);
        window.genysysRuntime.capabilities = new Map([
            ['genysys-browser-core', stableCapability('genysys-browser-core', 'browser', 'browser')],
            ['genysys-history', stableCapability('genysys-history', 'browser', 'sidebar')],
        ]);
        window.updateGENYSYSSurfaceAvailability(window.genysysRuntime.manifest);
        expect(document.getElementById('new-tab-btn').hidden).toBe(false);
        expect(document.getElementById('clear-history-btn').disabled).toBe(false);
        window.refreshGENYSYSSidebarConnectionState();
        window.refreshGENYSYSSidebarFeeds();

        const anyOfButton = document.createElement('button');
        anyOfButton.id = 'any-of-button';
        const defaultModeButton = document.createElement('button');
        defaultModeButton.id = 'default-mode-button';
        document.body.append(anyOfButton, defaultModeButton);
        const anyOfRule = {
            selector: '#any-of-button',
            anyOf: ['genysys-browser-core', 'genysys-search'],
            mode: 'disable',
        };
        const missingRule = { selector: '#missing-surface', capability: 'missing', mode: 'hide' };
        const defaultModeRule = { selector: '#default-mode-button', capability: 'missing' };
        window.GENYSYS_SURFACE_RULES.push(anyOfRule, missingRule, defaultModeRule);
        try {
            window.updateGENYSYSSurfaceAvailability(window.genysysRuntime.manifest);
            expect(anyOfButton.disabled).toBe(false);
            expect(defaultModeButton.hidden).toBe(true);
            expect(window.hasAnyGENYSYSCapability()).toBe(false);
        } finally {
            window.GENYSYS_SURFACE_RULES.splice(-3, 3);
        }
    });

    test('settings section availability activates the first enabled tab', async () => {
        await bootShell();
        const tabs = document.querySelectorAll('.settings-tab');
        const sections = document.querySelectorAll('.settings-section');
        expect(tabs.length).toBeGreaterThan(0);
        window.updateSettingsSectionAvailability({});
        window.updateSettingsSectionAvailability({ capabilities: [{ category: 'browser' }] });
        window.updateSettingsSectionAvailability({ capabilities: [] });
        const disabled = [...tabs].filter((t) => t.disabled);
        expect(disabled.length).toBeGreaterThan(0);
        const active = [...tabs].find((t) => t.classList.contains('active'));
        expect(active.disabled).toBe(false);
        const activeSection = document.querySelector(`.settings-section[data-section="${active.dataset.tab}"]`);
        expect(activeSection.classList.contains('active')).toBe(true);
        sections.forEach(() => { });

        const syntheticTab = document.createElement('button');
        syntheticTab.className = 'settings-tab';
        syntheticTab.dataset.tab = 'synthetic';
        const syntheticSection = document.createElement('section');
        syntheticSection.className = 'settings-section';
        syntheticSection.dataset.section = 'synthetic';
        tabs.forEach((tab) => tab.classList.remove('active'));
        document.body.prepend(syntheticTab, syntheticSection);
        try {
            window.updateSettingsSectionAvailability({ capabilities: [] });
            expect(syntheticTab.classList.contains('active')).toBe(true);
        } finally {
            syntheticTab.remove();
            syntheticSection.remove();
        }
        const orphanTab = document.createElement('button');
        orphanTab.className = 'settings-tab';
        orphanTab.dataset.tab = 'synthetic-orphan';
        document.querySelectorAll('.settings-tab').forEach((tab) => tab.classList.remove('active'));
        document.body.prepend(orphanTab);
        try {
            window.updateSettingsSectionAvailability({ capabilities: [] });
            expect(orphanTab.classList.contains('active')).toBe(true);
        } finally {
            orphanTab.remove();
        }
        document.querySelectorAll('.settings-tab, .settings-section').forEach((element) => element.remove());
        window.updateSettingsSectionAvailability({ capabilities: [] });
    });

    test('hasAnyGENYSYSCapability matches through the runtime map', async () => {
        await bootShell();
        window.genysysRuntime.capabilities = new Map([['genysys-search', { id: 'genysys-search', status: 'stable' }]]);
        expect(window.hasAnyGENYSYSCapability(['genysys-nope', 'genysys-search'])).toBe(true);
        expect(window.hasAnyGENYSYSCapability(['genysys-nope'])).toBe(false);
        expect(window.hasAnyGENYSYSCapability()).toBe(false);
    });
});

describe('shell: bookmarks-bar', () => {
    test('hides bar when setting off, renders empty state and items when on', async () => {
        await bootShell();
        window.settingsManager.set('general', 'showBookmarksBar', false);
        window.renderBookmarksBar();
        expect(document.getElementById('bookmarks-bar').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('bookmarks-bar-list').innerHTML).toBe('');

        window.settingsManager.set('general', 'showBookmarksBar', true);
        window.bookmarkManager.bookmarks = [];
        window.renderBookmarksBar();
        expect(document.getElementById('bookmarks-bar-count').textContent).toBe('0');
        expect(document.getElementById('bookmarks-bar-list').innerHTML).toContain('No bookmarks yet');

        window.bookmarkManager.addBookmark('Example', 'https://example.com/');
        window.renderBookmarksBar();
        const list = document.getElementById('bookmarks-bar-list');
        expect(list.querySelectorAll('.bookmarks-bar-item').length).toBe(1);
        list.querySelector('.bookmarks-bar-item').click();
        expect(window.tabManager.tabs.length).toBeGreaterThan(0);
    });

    test('url-only bookmark label falls back to hostname', async () => {
        await bootShell();
        window.settingsManager.set('general', 'showBookmarksBar', true);
        window.bookmarkManager.bookmarks = [];
        window.bookmarkManager.addBookmark('', 'https://label.test/deep');
        window.bookmarkManager.addBookmark('', 'file:///tmp/local-bookmark');
        window.bookmarkManager.addBookmark('', 'not a valid url');
        window.renderBookmarksBar();
        const items = [...document.querySelectorAll('.bookmarks-bar-item')];
        expect(items.map((item) => item.textContent)).toEqual([
            'label.test',
            'file:///tmp/local-bookmark',
            'not a valid url',
        ]);
    });

    test('missing bookmarks bar mounts are safe no-ops', async () => {
        await bootShell();
        document.getElementById('bookmarks-bar').remove();
        expect(() => window.renderBookmarksBar()).not.toThrow();
    });
});
