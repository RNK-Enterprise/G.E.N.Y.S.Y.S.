/**
 * GENYSYS™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

function readEffectiveDensityMode(densityKey, legacyKey, fallback = 'shell') {
    const densityMode = localStorage.getItem(densityKey);
    if (densityMode) {
        return densityMode;
    }

    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue === 'true') {
        return 'compact';
    }

    if (legacyValue === 'false') {
        return 'roomy';
    }

    return fallback;
}

function isDensityEffectivelyCompact(densityState) {
    return densityState === 'compact' ||
        (densityState === 'shell' && window.shellDensityState === 'compact');
}

window.tabBarDensityState = readEffectiveDensityMode('rnk-genysys-tab-bar-density', 'rnk-genysys-tab-bar-compact');
window.omniboxDensityState = readEffectiveDensityMode('rnk-genysys-omnibox-density', 'rnk-genysys-omnibox-compact');
window.settingsPanelDensityState = readEffectiveDensityMode('rnk-genysys-settings-panel-density', 'rnk-genysys-settings-dense');
window.statusbarDensityState = readEffectiveDensityMode('rnk-genysys-statusbar-density', 'rnk-genysys-statusbar-minimal');
window.titlebarDensityState = readEffectiveDensityMode('rnk-genysys-titlebar-density', 'rnk-genysys-titlebar-compact');
window.shellDensityState = localStorage.getItem('rnk-genysys-shell-density') || 'custom';
window.shortcutsDensityState = localStorage.getItem('rnk-genysys-shortcuts-density') || 'shell';
window.toastDensityState = localStorage.getItem('rnk-genysys-toast-density') || 'shell';
window.performancePanelDensityState = localStorage.getItem('rnk-genysys-performance-panel-density') || 'shell';
window.searchProviderDensityState = localStorage.getItem('rnk-genysys-search-provider-density') || 'shell';
window.bookmarksBarDensityState = localStorage.getItem('rnk-genysys-bookmarks-bar-density') || 'shell';
window.genysysSidebarDensityState = localStorage.getItem('rnk-genysys-sidebar-density') || 'shell';
window.sessionsDensityState = localStorage.getItem('rnk-genysys-sessions-density') || 'shell';
window.modalDensityState = localStorage.getItem('rnk-genysys-modal-density') || 'shell';
window.loadingDensityState = localStorage.getItem('rnk-genysys-loading-density') || 'shell';

window.settingsSectionCollapseState = {};
try {
    window.settingsSectionCollapseState = JSON.parse(localStorage.getItem('rnk-genysys-settings-section-collapse') || '{}') || {};
} catch {
    window.settingsSectionCollapseState = {};
}

window.SETTINGS_SECTION_COLLAPSIBLE = [
    { key: 'general', sectionId: 'settings-section-general', toggleId: 'settings-general-toggle' },
    { key: 'appearance', sectionId: 'settings-section-appearance', toggleId: 'settings-appearance-toggle' },
    { key: 'privacy', sectionId: 'settings-section-privacy', toggleId: 'settings-privacy-toggle' },
    { key: 'performance', sectionId: 'settings-section-performance', toggleId: 'settings-performance-toggle' },
    { key: 'genysys', sectionId: 'settings-section-genysys', toggleId: 'settings-genysys-toggle' },
    { key: 'advanced', sectionId: 'settings-section-advanced', toggleId: 'settings-advanced-toggle' }
];

window.applyLoadingDensityState = function applyLoadingDensityState(overlay = document.querySelector('.loading-overlay')) {
    const state = document.getElementById('settings-loading-density-state');
    const shellBtn = document.getElementById('settings-loading-density-shell');
    const roomyBtn = document.getElementById('settings-loading-density-roomy');
    const compactBtn = document.getElementById('settings-loading-density-compact');
    const effectiveCompact =
        window.loadingDensityState === 'compact' ||
        (window.loadingDensityState === 'shell' && window.shellDensityState === 'compact');
    const roomy = window.loadingDensityState === 'roomy';
    if (overlay) {
        overlay.classList.toggle('compact', effectiveCompact);
        overlay.classList.toggle('roomy', roomy);
    }

    syncDensityToggleGroup(window.loadingDensityState, state, shellBtn, roomyBtn, compactBtn);
}

function applyModalDensityState() {
    const state = document.getElementById('settings-modal-density-state');
    const shellBtn = document.getElementById('settings-modal-density-shell');
    const roomyBtn = document.getElementById('settings-modal-density-roomy');
    const compactBtn = document.getElementById('settings-modal-density-compact');
    const effectiveCompact =
        window.modalDensityState === 'compact' ||
        (window.modalDensityState === 'shell' && window.shellDensityState === 'compact');
    const roomy = window.modalDensityState === 'roomy';
    document.querySelectorAll('.modal-content').forEach((modalContent) => {
        modalContent.classList.toggle('compact', effectiveCompact);
        modalContent.classList.toggle('roomy', roomy);
    });

    syncDensityToggleGroup(window.modalDensityState, state, shellBtn, roomyBtn, compactBtn);
}

function applySuggestionDensityState() {
    const dropdown = document.getElementById('omnibox-suggestions');
    if (!dropdown) return;
    dropdown.classList.toggle('compact', window.shellDensityState === 'compact');
}

function syncDensityToggleGroup(mode, stateElement, shellBtn, roomyBtn, compactBtn, labels = {
    shell: 'Follow Shell',
    roomy: 'Roomy',
    compact: 'Compact'
}) {
    if (stateElement) {
        stateElement.textContent = labels[mode] ?? labels.roomy ?? labels.shell ?? labels.compact ?? mode;
    }
    if (shellBtn) {
        shellBtn.classList.toggle('active', mode === 'shell');
    }
    if (roomyBtn) {
        roomyBtn.classList.toggle('active', mode === 'roomy');
    }
    if (compactBtn) {
        compactBtn.classList.toggle('active', mode === 'compact');
    }
}

function syncActiveButtons(activeValue, buttonPairs) {
    buttonPairs.forEach(([button, value]) => {
        if (button) {
            button.classList.toggle('active', activeValue === value);
        }
    });
}

function saveSettingsSectionCollapseState() {
    localStorage.setItem('rnk-genysys-settings-section-collapse', JSON.stringify(window.settingsSectionCollapseState));
}

function isSettingsSectionCollapsed(key) {
    return Boolean(window.settingsSectionCollapseState[key]);
}

function setSettingsSectionCollapsed(key, collapsed) {
    window.settingsSectionCollapseState[key] = Boolean(collapsed);
    saveSettingsSectionCollapseState();
}

function applySettingsSectionCollapseState() {
    window.SETTINGS_SECTION_COLLAPSIBLE.forEach(({ key, sectionId, toggleId }) => {
        const section = document.getElementById(sectionId);
        const toggle = document.getElementById(toggleId);
        const collapsed = isSettingsSectionCollapsed(key);
        if (section) {
            section.classList.toggle('collapsed', collapsed);
        }
        if (toggle) {
            toggle.textContent = collapsed ? 'Expand' : 'Collapse';
            toggle.setAttribute('aria-expanded', String(!collapsed));
        }
    });
}

function toggleSettingsSection(key) {
    setSettingsSectionCollapsed(key, !isSettingsSectionCollapsed(key));
    applySettingsSectionCollapseState();
}

function applyTabBarCompactState() {
    const tabBar = document.getElementById('tab-bar');
    const tabs = document.getElementById('tabs');
    const tabSearch = document.getElementById('tab-search');
    const toggle = document.getElementById('tab-bar-compact-toggle');
    const state = document.getElementById('settings-tab-bar-density-state');
    const shellBtn = document.getElementById('settings-tab-bar-density-shell');
    const roomyBtn = document.getElementById('settings-tab-bar-density-roomy');
    const compactBtn = document.getElementById('settings-tab-bar-density-compact');
    const compact =
        window.tabBarDensityState === 'compact' ||
        (window.tabBarDensityState === 'shell' && window.shellDensityState === 'compact');
    const roomy = window.tabBarDensityState === 'roomy';
    if (tabBar) {
        tabBar.classList.toggle('compact', compact);
        tabBar.classList.toggle('roomy', roomy);
    }

    if (tabs) {
        tabs.classList.toggle('hidden', compact);
    }

    if (tabSearch) {
        tabSearch.classList.toggle('hidden', compact);
    }

    if (toggle) {
        toggle.textContent = compact ? 'Expand' : 'Compact';
        toggle.setAttribute('aria-expanded', String(!compact));
    }

    syncDensityToggleGroup(window.tabBarDensityState, state, shellBtn, roomyBtn, compactBtn);
}

function saveTabBarDensityState() {
    localStorage.setItem('rnk-genysys-tab-bar-density', window.tabBarDensityState);
}

function setTabBarDensityState(mode) {
    window.tabBarDensityState = mode;
    saveTabBarDensityState();
    applyTabBarCompactState();
    window.syncShellDensityStateFromSurfaces();
}

function toggleTabBarCompact() {
    const effectiveCompact = window.tabBarDensityState === 'compact' || (window.tabBarDensityState === 'shell' && window.shellDensityState === 'compact');
    setTabBarDensityState(effectiveCompact ? 'roomy' : 'compact');
}

function applyOmniboxCompactState() {
    const omniboxContainer = document.getElementById('omnibox-container');
    const omniboxWrapper = document.querySelector('.omnibox-wrapper');
    const searchProviderBtn = document.getElementById('search-provider-btn');
    const sidebarBtn = document.getElementById('sidebar-btn');
    const bookmarkBtn = document.getElementById('bookmark-btn');
    const menuBtn = document.getElementById('menu-btn');
    const toggle = document.getElementById('omnibox-compact-toggle');
    const state = document.getElementById('settings-omnibox-density-state');
    const shellBtn = document.getElementById('settings-omnibox-density-shell');
    const roomyBtn = document.getElementById('settings-omnibox-density-roomy');
    const compactBtn = document.getElementById('settings-omnibox-density-compact');
    const compact =
        window.omniboxDensityState === 'compact' ||
        (window.omniboxDensityState === 'shell' && window.shellDensityState === 'compact');
    const roomy = window.omniboxDensityState === 'roomy';
    if (omniboxContainer) {
        omniboxContainer.classList.toggle('compact', compact);
        omniboxContainer.classList.toggle('roomy', roomy);
    }

    if (omniboxWrapper) {
        omniboxWrapper.classList.toggle('compact', compact);
        omniboxWrapper.classList.toggle('roomy', roomy);
    }

    [searchProviderBtn, sidebarBtn, bookmarkBtn, menuBtn].forEach((button) => {
        if (button) {
            button.classList.toggle('hidden', compact);
        }
    });

    if (toggle) {
        toggle.textContent = compact ? 'Expand' : 'Slim';
        toggle.setAttribute('aria-expanded', String(!compact));
    }

    syncDensityToggleGroup(window.omniboxDensityState, state, shellBtn, roomyBtn, compactBtn);

    window.updateSearchProviderIcon();
}

window.readEffectiveDensityMode = readEffectiveDensityMode;
window.isDensityEffectivelyCompact = isDensityEffectivelyCompact;
window.applyModalDensityState = applyModalDensityState;
window.applySuggestionDensityState = applySuggestionDensityState;
window.syncDensityToggleGroup = syncDensityToggleGroup;
window.syncActiveButtons = syncActiveButtons;
window.saveSettingsSectionCollapseState = saveSettingsSectionCollapseState;
window.isSettingsSectionCollapsed = isSettingsSectionCollapsed;
window.setSettingsSectionCollapsed = setSettingsSectionCollapsed;
window.applySettingsSectionCollapseState = applySettingsSectionCollapseState;
window.toggleSettingsSection = toggleSettingsSection;
window.applyTabBarCompactState = applyTabBarCompactState;
window.saveTabBarDensityState = saveTabBarDensityState;
window.setTabBarDensityState = setTabBarDensityState;
window.toggleTabBarCompact = toggleTabBarCompact;
window.applyOmniboxCompactState = applyOmniboxCompactState;
