/**
 * Axis™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

function getActiveBrowserTab() {
    if (!window.tabManager || !Array.isArray(window.tabManager.tabs)) {
        return null;
    }
    return window.tabManager.tabs.find(tab => tab.id === window.tabManager.activeTabId) || null;
}

function getTabHost(tab) {
    if (!tab?.url) return '';
    try {
        return new URL(tab.url).hostname.replace(/^www\./i, '');
    } catch {
        return '';
    }
}

function focusOmniboxAndMaybeSearchProvider() {
    focusOmniboxOnly();
    openSearchProviderModal();
}

function focusOmniboxOnly() {
    document.getElementById('omnibox')?.focus();
}

function focusOmniboxAndSelectAll() {
    const omnibox = document.getElementById('omnibox');
    if (!omnibox) return;
    omnibox.focus();
    omnibox.select();
}

function openSearchProviderModal() {
    showElement('search-provider-modal');
}

function setOmniboxValueAndFocus(value, selectionStart = 0, selectionEnd = String(value).length) {
    const omnibox = document.getElementById('omnibox');
    if (!omnibox) return;
    omnibox.value = value;
    omnibox.focus();
    omnibox.setSelectionRange(selectionStart, selectionEnd);
}

function togglePerformancePanel() {
    window.perfMonitor.toggle();
}

function openSessionsView() {
    window.showSessionsModal();
}

function openRecentlyClosedView() {
    window.showRecentlyClosedModal();
}

function closeSearchProviderModal() {
    hideElement('search-provider-modal');
}

function setElementHidden(target, hidden) {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    element?.classList.toggle('hidden', hidden);
}

window.showElement = function showElement(target) {
    setElementHidden(target, false);
}

window.hideElement = function hideElement(target) {
    setElementHidden(target, true);
}

function hideModal(modal) {
    hideElement(modal);
}

function openAxisSettingsSection(sectionSelector) {
    window.openSettings();
    document.querySelector('.settings-tab[data-tab="axis"]')?.click();
    if (sectionSelector) {
        document.querySelector(sectionSelector)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function focusTabSearch() {
    window.tabSearch?.focus();
}

function toggleActiveTabPinnedState() {
    if (!window.tabManager?.activeTabId) return false;
    window.tabManager.pinTab(window.tabManager.activeTabId);
    return true;
}

// Single export block — the sidebar/command-palette helpers were removed with
// the AXIS SHELL sidebar DOM; only helpers with live call sites are published.
window.getActiveBrowserTab = getActiveBrowserTab;
window.getTabHost = getTabHost;
window.focusOmniboxAndMaybeSearchProvider = focusOmniboxAndMaybeSearchProvider;
window.focusOmniboxOnly = focusOmniboxOnly;
window.focusOmniboxAndSelectAll = focusOmniboxAndSelectAll;
window.openSearchProviderModal = openSearchProviderModal;
window.setOmniboxValueAndFocus = setOmniboxValueAndFocus;
window.togglePerformancePanel = togglePerformancePanel;
window.openSessionsView = openSessionsView;
window.openRecentlyClosedView = openRecentlyClosedView;
window.closeSearchProviderModal = closeSearchProviderModal;
window.setElementHidden = setElementHidden;
window.hideModal = hideModal;
window.openAxisSettingsSection = openAxisSettingsSection;
window.focusTabSearch = focusTabSearch;
window.toggleActiveTabPinnedState = toggleActiveTabPinnedState;
