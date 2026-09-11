/**
 * Axis™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

/**
 * Resolve the active search provider from the shared shell state
 * (window.searchProviders / window.currentSearchProvider, owned by
 * chrome-bindings-b.js). Defensive so a missing map never breaks callers.
 */
function getSearchProviderState() {
    const providerId = window.currentSearchProvider ||
        localStorage.getItem('search-provider') || 'duckduckgo';
    const providers = window.searchProviders || {};
    const provider = providers[providerId] || providers.duckduckgo || null;
    return {
        id: providerId,
        name: provider?.name || providerId,
        url: provider?.url || '',
    };
}

function getSearchProviderLabel(state) {
    return state?.name || 'DuckDuckGo';
}
window.getSearchProviderState = getSearchProviderState;
window.getSearchProviderLabel = getSearchProviderLabel;

function getAxisDownloadSummary() {
    const downloads = window.downloadManager?.getDownloads?.() || [];
    const active = downloads.filter(download => download.status === 'downloading');
    const paused = downloads.filter(download => download.status === 'paused');
    const completed = downloads.filter(download => download.status === 'completed');
    const failed = downloads.filter(download => download.status === 'failed');
    return { downloads, active, paused, completed, failed };
}

function isDownloadableUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:', 'file:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

function startDownloadFromActiveTab() {
    if (!window.isAxisCapabilityAvailable('axis-downloads')) return false;
    const activeTab = window.getActiveBrowserTab();
    if (!isDownloadableUrl(activeTab?.url)) {
        window.updateStatusBar('No active page available to download');
        return false;
    }

    const filename = activeTab.title?.trim() || window.downloadManager.getFilenameFromUrl(activeTab.url);
    const download = window.downloadManager.startDownload(activeTab.url, filename);
    window.updateStatusBar(`Download started: ${download.filename}`);
    return true;
}

function getThemeLabel(theme) {
    switch (theme) {
        case 'dark':
            return 'Dark';
        case 'light':
            return 'Light';
        default:
            return 'Dark Neutral';
    }
}

function applyThemeState(theme = settingsManager.getAll().appearance.theme) {
    const body = document.body;
    const normalized = ['dark', 'light'].includes(theme) ? theme : 'dark-neutral';
    body.classList.remove('theme-dark-neutral', 'theme-dark', 'theme-light');
    body.classList.add(`theme-${normalized}`);
    body.dataset.theme = normalized;
    return normalized;
}

function setThemeState(theme, { statusMessage = null, fromAxis = false } = {}) {
    const normalized = applyThemeState(theme);
    const themeSelect = document.getElementById('setting-theme');
    if (themeSelect) {
        themeSelect.value = normalized;
    }
    window.settingsManager.set('appearance', 'theme', normalized);
    if (statusMessage) {
        window.updateStatusBar(statusMessage);
    } else if (fromAxis) {
        window.updateStatusBar(`Theme set to ${getThemeLabel(normalized)}`);
    }
    return normalized;
}

// Single export block — the sidebar-surface renderers were removed with the
// AXIS SHELL sidebar DOM; only live helpers are published.
window.getAxisDownloadSummary = getAxisDownloadSummary;
window.startDownloadFromActiveTab = startDownloadFromActiveTab;
window.getThemeLabel = getThemeLabel;
window.applyThemeState = applyThemeState;
window.setThemeState = setThemeState;
