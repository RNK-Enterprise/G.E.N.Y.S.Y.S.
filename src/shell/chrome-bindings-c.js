/**
 * VEIL™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */
window.bookmarkBtn = document.getElementById('bookmark-btn');
window.bindClickHandlers([
    [window.bookmarkBtn, () => {
    const activeTab = window.tabManager.tabs.find(t => t.id === window.tabManager.activeTabId);
    if (activeTab) {
        if (window.bookmarkManager.isBookmarked(activeTab.url)) {
            const bookmark = window.bookmarkManager.getBookmark(activeTab.url);
            window.bookmarkManager.removeBookmark(bookmark.id);
            window.bookmarkBtn.textContent = '☆';
            updateStatusBar('Bookmark removed');
        } else {
            window.bookmarkManager.addBookmark(activeTab.title, activeTab.url);
            window.bookmarkBtn.textContent = '★';
            updateStatusBar('Bookmarked!');
        }
    }
    }]
]);

// Update bookmark button state when tab changes
function updateBookmarkButton() {
    const activeTab = window.tabManager.tabs.find(t => t.id === window.tabManager.activeTabId);
    if (activeTab && window.bookmarkManager.isBookmarked(activeTab.url)) {
        window.bookmarkBtn.textContent = '★';
    } else {
        window.bookmarkBtn.textContent = '☆';
    }
}

function navigateToUrl(url) {
    console.log(`Navigating to: ${url}`);
    
    const activeTab = window.tabManager.tabs.find(t => t.id === window.tabManager.activeTabId);
    if (activeTab) {
        window.tabManager.navigateActiveTab(url);
        window.omnibox.value = url;
    }
}
// ===================================================================
// Status Bar
// ===================================================================
function updateStatusBar(text) {
    document.getElementById('status-text').textContent = text;
}

function setVEILStatusIndicator(connected, disconnectedTone = 'var(--text-secondary)') {
    // Status indicator is owned by the VEIL engine runtime; this only restyles
    // the badge when other surfaces toggle it.
    const status = document.getElementById('veil-status');
    if (!status) return;
    status.classList.toggle('connected', connected);
    status.style.color = connected ? 'var(--toxic-green)' : disconnectedTone;
}

function setVEILBridgePerformanceState(connected) {
    const perfVEIL = document.getElementById('perf-veil');
    if (!perfVEIL) return;
    perfVEIL.textContent = connected ? 'Connected' : 'Disconnected';
}

// FPS Counter
window.lastTime = performance.now();
window.frameCount = 0;

function updateFPS() {
    window.frameCount++;
    const now = performance.now();
    if (now - window.lastTime >= 1000) {
        document.getElementById('fps-counter').textContent = `${window.frameCount} FPS`;
        window.frameCount = 0;
        window.lastTime = now;
    }
    requestAnimationFrame(updateFPS);
}

updateFPS();

// ===================================================================
// Keyboard Shortcuts
// ===================================================================
document.addEventListener('keydown', (e) => {
    // Ctrl+T: New Tab
    if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        window.tabManager.createTab();
    }
    
    // Ctrl+W: Close Tab
    if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (window.tabManager.activeTabId) {
            window.tabManager.closeTab(window.tabManager.activeTabId);
        }
    }
    
    // Ctrl+Tab: Next Tab
    if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const currentIndex = window.tabManager.tabs.findIndex(t => t.id === window.tabManager.activeTabId);
        const nextIndex = (currentIndex + 1) % window.tabManager.tabs.length;
        window.tabManager.activateTab(window.tabManager.tabs[nextIndex].id);
    }
    
    // Ctrl+Shift+Tab: Previous Tab
    if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = window.tabManager.tabs.findIndex(t => t.id === window.tabManager.activeTabId);
        const prevIndex = (currentIndex - 1 + window.tabManager.tabs.length) % window.tabManager.tabs.length;
        window.tabManager.activateTab(window.tabManager.tabs[prevIndex].id);
    }
    
    // Ctrl+R or F5: Refresh
    if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
        e.preventDefault();
        window.tabManager.refresh();
    }
    
    // Ctrl+L: Focus Omnibox
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        window.focusOmniboxAndSelectAll();
    }
    
    // Ctrl+Shift+T: Reopen Closed Tab
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        if (!window.isVEILCapabilityAvailable('veil-history')) {
            return;
        }
        const closed = window.recentlyClosedManager.getRecentlyClosed();
        if (closed.length > 0) {
            const tab = closed[0];
            window.tabManager.createTab(tab.url);
            window.toastManager.success('Tab Restored', tab.title || 'Untitled');
        } else {
            window.toastManager.info('No Closed Tabs', 'No recently closed tabs to restore', 2000);
        }
    }
    
    // Ctrl+Shift+S: Save Session
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (!window.isVEILCapabilityAvailable('veil-browser-core')) {
            return;
        }
        const name = prompt('Enter session name:');
        if (name) {
            window.sessionManager.saveSession(name, window.tabManager.tabs);
            updateStatusBar(`Session saved: ${name}`);
            window.toastManager.success('Session Saved', `${name} - ${window.tabManager.tabs.length} tabs`);
        }
    }
    
    // Ctrl+F: Search Tabs
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        window.focusTabSearch();
        window.toastManager.info('Tab Search', 'Search across all open tabs', 2000);
    }

    // Ctrl+K: Toggle header Spotlight (contextual actions)
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        window.toggleVEILSpotlight?.();
    }
    
    // Alt+Left: Back
    if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        window.tabManager.goBack();
    }
    
    // Alt+Right: Forward
    if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        window.tabManager.goForward();
    }

    // Ctrl+,: Settings
    if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        openSettings();
    }

    // Ctrl+Shift+I: Open devtools
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        window.invoke('open_devtools');
    }
});
// ===================================================================
// Settings Panel
// ===================================================================
function openSettings() {
    const panel = document.getElementById('settings-panel');
    window.showElement(panel);
    loadSettings();
    window.applySettingsSectionCollapseState();
    window.applySettingsDenseState();
    window.applySettingsDensityControls();
}

function closeSettings() {
    const panel = document.getElementById('settings-panel');
    window.hideElement(panel);
}

function loadSettings() {
    const settings = window.settingsManager.getAll();
    
    // General
    document.getElementById('setting-homepage').value = settings.general.homepage;
    document.getElementById('setting-search-engine').value = settings.general.searchEngine;
    document.getElementById('setting-new-tab').value = settings.general.newTabBehavior;
    document.getElementById('setting-show-bookmarks-bar').checked = settings.general.showBookmarksBar;
    
    // Appearance
    document.getElementById('setting-theme').value = settings.appearance.theme;
    window.applyThemeState(settings.appearance.theme);
    document.getElementById('setting-font-size').value = settings.appearance.fontSize;
    document.getElementById('setting-show-status-bar').checked = settings.appearance.showStatusBar;
    document.getElementById('setting-enable-animations').checked = settings.appearance.enableAnimations;
    
    // Privacy
    document.getElementById('setting-block-cookies').checked = settings.privacy.blockThirdPartyCookies;
    document.getElementById('setting-enable-dnt').checked = settings.privacy.enableDNT;
    document.getElementById('setting-clear-history').checked = settings.privacy.clearHistoryOnExit;
    
    // Performance
    document.getElementById('setting-hardware-accel').checked = settings.performance.enableHardwareAcceleration;
    document.getElementById('setting-veil-engines').checked = settings.performance.enableVEILEngines ?? true;
    document.getElementById('setting-preload-pages').checked = settings.performance.preloadPages;
    document.getElementById('setting-cache-size').value = settings.performance.maxCacheSize;
    
    // Advanced
    document.getElementById('setting-dev-tools').checked = settings.advanced.enableDevTools;
    document.getElementById('setting-experimental').checked = settings.advanced.enableExperimentalFeatures;
    document.getElementById('setting-user-agent').value = settings.advanced.customUserAgent;
}

function saveSettings() {
    // General
    window.settingsManager.set('general', 'homepage', document.getElementById('setting-homepage').value);
    window.settingsManager.set('general', 'searchEngine', document.getElementById('setting-search-engine').value);
    window.settingsManager.set('general', 'newTabBehavior', document.getElementById('setting-new-tab').value);
    window.settingsManager.set('general', 'showBookmarksBar', document.getElementById('setting-show-bookmarks-bar').checked);
    
    // Appearance
    window.setThemeState(document.getElementById('setting-theme').value);
    window.settingsManager.set('appearance', 'fontSize', document.getElementById('setting-font-size').value);
    window.settingsManager.set('appearance', 'showStatusBar', document.getElementById('setting-show-status-bar').checked);
    window.settingsManager.set('appearance', 'enableAnimations', document.getElementById('setting-enable-animations').checked);
    
    // Privacy
    window.settingsManager.set('privacy', 'blockThirdPartyCookies', document.getElementById('setting-block-cookies').checked);
    window.settingsManager.set('privacy', 'enableDNT', document.getElementById('setting-enable-dnt').checked);
    window.settingsManager.set('privacy', 'clearHistoryOnExit', document.getElementById('setting-clear-history').checked);
    
    // Performance
    window.settingsManager.set('performance', 'enableHardwareAcceleration', document.getElementById('setting-hardware-accel').checked);
    window.settingsManager.set('performance', 'enableVEILEngines', document.getElementById('setting-veil-engines').checked);
    window.settingsManager.set('performance', 'preloadPages', document.getElementById('setting-preload-pages').checked);
    window.settingsManager.set('performance', 'maxCacheSize', parseInt(document.getElementById('setting-cache-size').value));
    
    // Advanced
    window.settingsManager.set('advanced', 'enableDevTools', document.getElementById('setting-dev-tools').checked);
    window.settingsManager.set('advanced', 'enableExperimentalFeatures', document.getElementById('setting-experimental').checked);
    window.settingsManager.set('advanced', 'customUserAgent', document.getElementById('setting-user-agent').value);

    window.renderBookmarksBar();
}

// Settings navigation
window.bindItemEvents(document.querySelectorAll('.settings-tab'), {
    click: (tab) => {
        if (tab.disabled || tab.classList.contains('disabled')) {
            return;
        }

        const targetTab = tab.dataset.tab;
        const targetSection = document.querySelector(`.settings-section[data-section="${targetTab}"]`);
        if (!targetSection || targetSection.hidden) {
            return;
        }

        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
        targetSection.classList.add('active');
    }
});

// Settings change listeners (auto-save)
const settingInputs = document.querySelectorAll('#settings-panel input, #settings-panel select');
settingInputs.forEach(input => {
    input.addEventListener('change', saveSettings);
});


function applyVEILRuntimeStatus(connected, statusMessage = null) {
    setVEILStatusIndicator(connected, connected ? undefined : 'var(--text-secondary)');
    setVEILBridgePerformanceState(connected);
    if (statusMessage) updateStatusBar(statusMessage);
}

window.bindClickHandlers([
    ['veil-status', () => {
        if (window.veilRuntime.connected) {
            window.veilRuntime.stop();
            applyVEILRuntimeStatus(false, 'VEIL Runtime stopped');
        } else {                window.veilRuntime.start({ getTabs: () => window.tabManager?.tabs || [] }).then(() => {
                    applyVEILRuntimeStatus(true, 'VEIL Runtime online');
                });
        }
    }]
]);
window.perfMonitor = new window.PerformanceMonitor();










// Single export block — duplicate fragments left by the VEIL SHELL sidebar
// removal are collapsed here so each name is published exactly once.
window.navigateToUrl = navigateToUrl;
window.setVEILStatusIndicator = setVEILStatusIndicator;
window.updateBookmarkButton = updateBookmarkButton;
window.updateStatusBar = updateStatusBar;
window.updateFPS = updateFPS;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.settingInputs = settingInputs;
window.applyVEILRuntimeStatus = applyVEILRuntimeStatus;
