/**
 * VEIL™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

window.settingsDensityControlConfigs = [
    {
        label: 'Shell Density',
        stateId: 'settings-shell-density-state',
        stateLabel: 'Custom',
        buttons: [
            { id: 'settings-shell-density-roomy', label: 'Roomy All', handler: () => { setShellDensityState('roomy'); window.updateStatusBar('Shell set to roomy'); } },
            { id: 'settings-shell-density-compact', label: 'Compact All', handler: () => { setShellDensityState('compact'); window.updateStatusBar('Shell set to compact'); } },
            { id: 'settings-shell-density-custom', label: 'Custom', handler: () => {
                window.shellDensityState = 'custom';
                window.saveShellDensityState();
                window.updateShellDensityToggleLabel();
                window.applySettingsDensityControls();
                window.updateStatusBar('Shell set to custom');
            } },
        ],
    },
    {
        label: 'Settings Density',
        stateId: 'settings-settings-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-settings-density-shell', label: 'Follow Shell', handler: () => { window.setSettingsPanelDensityState('shell'); window.updateStatusBar('Settings follow shell'); } },
            { id: 'settings-settings-density-roomy', label: 'Roomy', handler: () => { window.setSettingsPanelDensityState('roomy'); window.updateStatusBar('Settings set to roomy'); } },
            { id: 'settings-settings-density-compact', label: 'Compact', handler: () => { window.setSettingsPanelDensityState('compact'); window.updateStatusBar('Settings set to compact'); } },
        ],
    },
    {
        label: 'Titlebar Density',
        stateId: 'settings-titlebar-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-titlebar-density-shell', label: 'Follow Shell', handler: () => { window.setTitlebarDensityState('shell'); window.updateStatusBar('Titlebar follows shell'); } },
            { id: 'settings-titlebar-density-roomy', label: 'Roomy', handler: () => { window.setTitlebarDensityState('roomy'); window.updateStatusBar('Titlebar set to roomy'); } },
            { id: 'settings-titlebar-density-compact', label: 'Compact', handler: () => { window.setTitlebarDensityState('compact'); window.updateStatusBar('Titlebar set to compact'); } },
        ],
    },
    {
        label: 'Tab Bar Density',
        stateId: 'settings-tab-bar-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-tab-bar-density-shell', label: 'Follow Shell', handler: () => { window.setTabBarDensityState('shell'); window.updateStatusBar('Tab bar follows shell'); } },
            { id: 'settings-tab-bar-density-roomy', label: 'Roomy', handler: () => { window.setTabBarDensityState('roomy'); window.updateStatusBar('Tab bar set to roomy'); } },
            { id: 'settings-tab-bar-density-compact', label: 'Compact', handler: () => { window.setTabBarDensityState('compact'); window.updateStatusBar('Tab bar set to compact'); } },
        ],
    },
    {
        label: 'Omnibox Density',
        stateId: 'settings-omnibox-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-omnibox-density-shell', label: 'Follow Shell', handler: () => { window.setOmniboxDensityState('shell'); window.updateStatusBar('Omnibox follows shell'); } },
            { id: 'settings-omnibox-density-roomy', label: 'Roomy', handler: () => { window.setOmniboxDensityState('roomy'); window.updateStatusBar('Omnibox set to roomy'); } },
            { id: 'settings-omnibox-density-compact', label: 'Compact', handler: () => { window.setOmniboxDensityState('compact'); window.updateStatusBar('Omnibox set to compact'); } },
        ],
    },
    {
        label: 'Toast Density',
        stateId: 'settings-toast-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-toast-density-shell', label: 'Follow Shell', handler: () => { setToastDensityState('shell'); window.updateStatusBar('Toast density follows shell'); } },
            { id: 'settings-toast-density-roomy', label: 'Roomy', handler: () => { setToastDensityState('roomy'); window.updateStatusBar('Toast density set to roomy'); } },
            { id: 'settings-toast-density-compact', label: 'Compact', handler: () => { setToastDensityState('compact'); window.updateStatusBar('Toast density set to compact'); } },
        ],
    },
    {
        label: 'Search Provider Density',
        stateId: 'settings-search-provider-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-search-provider-density-shell', label: 'Follow Shell', handler: () => { setSearchProviderDensityState('shell'); window.updateStatusBar('Search provider follows shell'); } },
            { id: 'settings-search-provider-density-roomy', label: 'Roomy', handler: () => { setSearchProviderDensityState('roomy'); window.updateStatusBar('Search provider set to roomy'); } },
            { id: 'settings-search-provider-density-compact', label: 'Compact', handler: () => { setSearchProviderDensityState('compact'); window.updateStatusBar('Search provider set to compact'); } },
        ],
    },
    {
        label: 'Bookmarks Bar Density',
        stateId: 'settings-bookmarks-bar-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-bookmarks-bar-density-shell', label: 'Follow Shell', handler: () => { setBookmarksBarDensityState('shell'); window.updateStatusBar('Bookmarks bar follows shell'); } },
            { id: 'settings-bookmarks-bar-density-roomy', label: 'Roomy', handler: () => { setBookmarksBarDensityState('roomy'); window.updateStatusBar('Bookmarks bar set to roomy'); } },
            { id: 'settings-bookmarks-bar-density-compact', label: 'Compact', handler: () => { setBookmarksBarDensityState('compact'); window.updateStatusBar('Bookmarks bar set to compact'); } },
        ],
    },
    {
        label: 'Sessions & History Density',
        stateId: 'settings-sessions-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-sessions-density-shell', label: 'Follow Shell', handler: () => { setSessionsDensityState('shell'); window.updateStatusBar('Sessions and history follow shell'); } },
            { id: 'settings-sessions-density-roomy', label: 'Roomy', handler: () => { setSessionsDensityState('roomy'); window.updateStatusBar('Sessions and history set to roomy'); } },
            { id: 'settings-sessions-density-compact', label: 'Compact', handler: () => { setSessionsDensityState('compact'); window.updateStatusBar('Sessions and history set to compact'); } },
        ],
    },
    {
        label: 'Status Bar Density',
        stateId: 'settings-statusbar-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-statusbar-density-shell', label: 'Follow Shell', handler: () => { window.setStatusbarDensityState('shell'); window.updateStatusBar('Status bar follows shell'); } },
            { id: 'settings-statusbar-density-roomy', label: 'Roomy', handler: () => { window.setStatusbarDensityState('roomy'); window.updateStatusBar('Status bar set to roomy'); } },
            { id: 'settings-statusbar-density-compact', label: 'Compact', handler: () => { window.setStatusbarDensityState('compact'); window.updateStatusBar('Status bar set to compact'); } },
        ],
    },
    {
        label: 'Modal Density',
        stateId: 'settings-modal-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-modal-density-shell', label: 'Follow Shell', handler: () => { window.setModalDensityState('shell'); window.updateStatusBar('Modal density follows shell'); } },
            { id: 'settings-modal-density-roomy', label: 'Roomy', handler: () => { window.setModalDensityState('roomy'); window.updateStatusBar('Modal density set to roomy'); } },
            { id: 'settings-modal-density-compact', label: 'Compact', handler: () => { window.setModalDensityState('compact'); window.updateStatusBar('Modal density set to compact'); } },
        ],
    },
    {
        label: 'Loading Overlay Density',
        stateId: 'settings-loading-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-loading-density-shell', label: 'Follow Shell', handler: () => { window.setLoadingDensityState('shell'); window.updateStatusBar('Loading overlay follows shell'); } },
            { id: 'settings-loading-density-roomy', label: 'Roomy', handler: () => { window.setLoadingDensityState('roomy'); window.updateStatusBar('Loading overlay set to roomy'); } },
            { id: 'settings-loading-density-compact', label: 'Compact', handler: () => { window.setLoadingDensityState('compact'); window.updateStatusBar('Loading overlay set to compact'); } },
        ],
    },
    {
        label: 'Keyboard Shortcuts Density',
        stateId: 'settings-shortcuts-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-shortcuts-density-shell', label: 'Follow Shell', handler: () => { setShortcutsDensityState('shell'); window.updateStatusBar('Shortcuts help follows shell'); } },
            { id: 'settings-shortcuts-density-roomy', label: 'Roomy', handler: () => { setShortcutsDensityState('roomy'); window.updateStatusBar('Shortcuts help set to roomy'); } },
            { id: 'settings-shortcuts-density-compact', label: 'Compact', handler: () => { setShortcutsDensityState('compact'); window.updateStatusBar('Shortcuts help set to compact'); } },
        ],
    },
    {
        label: 'Performance Panel Density',
        stateId: 'settings-performance-density-state',
        stateLabel: 'Follow Shell',
        buttons: [
            { id: 'settings-performance-density-shell', label: 'Follow Shell', handler: () => { setPerformancePanelDensityState('shell'); window.updateStatusBar('Performance panel follows shell'); } },
            { id: 'settings-performance-density-roomy', label: 'Roomy', handler: () => { setPerformancePanelDensityState('roomy'); window.updateStatusBar('Performance panel set to roomy'); } },
            { id: 'settings-performance-density-compact', label: 'Compact', handler: () => { setPerformancePanelDensityState('compact'); window.updateStatusBar('Performance panel set to compact'); } },
        ],
    },
];

function renderSettingsDensityControls() {
    const container = document.getElementById('settings-density-matrix');
    if (!container) return;

    container.innerHTML = window.settingsDensityControlConfigs.map(({ label, stateId, stateLabel, buttons }) => `
        <div class="setting-item">
            <label>${label}</label>
            <div class="settings-density-controls">
                <span id="${stateId}" class="veil-summary">${stateLabel}</span>
                <div class="settings-density-buttons">
                    ${buttons.map(({ id, label: buttonLabel }) => `<button id="${id}" class="action-btn" type="button">${buttonLabel}</button>`).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

renderSettingsDensityControls();

function syncShellDensityStateFromSurfaces() {
    const compactStates = [
        window.isDensityEffectivelyCompact(window.titlebarDensityState),
        window.isDensityEffectivelyCompact(window.tabBarDensityState),
        window.isDensityEffectivelyCompact(window.omniboxDensityState),
        window.isDensityEffectivelyCompact(window.settingsPanelDensityState),
        window.isDensityEffectivelyCompact(window.statusbarDensityState)
    ];
    const allCompact = compactStates.every(Boolean);
    const allRoomy = compactStates.every((value) => !value);

    window.shellDensityState = allCompact ? 'compact' : allRoomy ? 'roomy' : 'custom';
    window.saveShellDensityState();
    window.updateShellDensityToggleLabel();
    window.applyTitlebarCompactState();
    window.applyTabBarCompactState();
    window.applyOmniboxCompactState();
    window.applySettingsDenseState();
    window.applyStatusbarMinimalState();
    applyDensityDependentSurfaces();
}

function setShellDensityState(mode) {
    window.shellDensityState = mode;
    window.saveShellDensityState();

    const compact = mode === 'compact';
    window.settingsPanelDensityState = compact ? 'compact' : 'roomy';
    window.statusbarDensityState = compact ? 'compact' : 'roomy';

    window.saveTitlebarDensityState();
    window.saveTabBarDensityState();
    window.saveOmniboxDensityState();
    window.saveSettingsPanelDensityState();
    window.saveStatusbarDensityState();

    window.applyTitlebarCompactState();
    window.applyTabBarCompactState();
    window.applyOmniboxCompactState();
    window.applySettingsDenseState();
    window.applyStatusbarMinimalState();
    window.updateShellDensityToggleLabel();
    window.applySettingsDensityControls();
    applyDensityDependentSurfaces();
}

window.renderSettingsDensityControls = renderSettingsDensityControls;
window.syncShellDensityStateFromSurfaces = syncShellDensityStateFromSurfaces;
window.setShellDensityState = setShellDensityState;
