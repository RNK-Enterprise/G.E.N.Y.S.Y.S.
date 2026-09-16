/**
 * VEIL™
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */
function toggleShellDensity() {
    const nextMode = window.shellDensityState === 'compact' ? 'roomy' : 'compact';
    setShellDensityState(nextMode);
}

function applyDensityDependentSurfaces() {
    applyToastDensityState();
    applyShortcutsDenseState();
    window.applyLoadingDensityState();
    window.applyModalDensityState();
    window.applySuggestionDensityState();
    window.applyPerformancePanelDensityState();
    applySearchProviderDensityState();
    applySessionsDensityState();
    applyBookmarksBarVisibilityState();
}

function isShortcutsEffectivelyDense() {
    return window.shortcutsDensityState === 'compact' ||
        (window.shortcutsDensityState === 'shell' && window.shellDensityState === 'compact');
}

function applyShortcutsDenseState() {
    const modal = document.getElementById('shortcuts-help');
    const toggle = document.getElementById('shortcuts-dense-toggle');
    const state = document.getElementById('settings-shortcuts-density-state');
    const shellBtn = document.getElementById('settings-shortcuts-density-shell');
    const roomyBtn = document.getElementById('settings-shortcuts-density-roomy');
    const compactBtn = document.getElementById('settings-shortcuts-density-compact');
    const dense = isShortcutsEffectivelyDense();
    const roomy = window.shortcutsDensityState === 'roomy';

    if (modal) {
        modal.classList.toggle('dense', dense);
        modal.classList.toggle('roomy', roomy);
    }

    if (toggle) {
        toggle.textContent = dense ? 'Roomy' : 'Dense';
        toggle.setAttribute('aria-expanded', String(!dense));
        toggle.classList.toggle('dense', dense);
        toggle.classList.toggle('roomy', roomy);
    }

    window.syncDensityToggleGroup(window.shortcutsDensityState, state, shellBtn, roomyBtn, compactBtn);
}

function toggleShortcutsDense() {
    setShortcutsDensityState(isShortcutsEffectivelyDense() ? 'roomy' : 'compact');
}

function saveShortcutsDensityState() {
    localStorage.setItem('rnk-veil-shortcuts-density', window.shortcutsDensityState);
}

function setShortcutsDensityState(mode) {
    window.shortcutsDensityState = mode;
    saveShortcutsDensityState();
    applyShortcutsDenseState();
}

function applyToastDensityState() {
    const container = document.getElementById('toast-container');
    const state = document.getElementById('settings-toast-density-state');
    const shellBtn = document.getElementById('settings-toast-density-shell');
    const roomyBtn = document.getElementById('settings-toast-density-roomy');
    const compactBtn = document.getElementById('settings-toast-density-compact');
    const effectiveCompact =
        window.toastDensityState === 'compact' || (window.toastDensityState === 'shell' && window.shellDensityState === 'compact');

    if (container) {
        container.classList.toggle('compact', effectiveCompact);
    }

    window.syncDensityToggleGroup(window.toastDensityState, state, shellBtn, roomyBtn, compactBtn);
}

function saveToastDensityState() {
    localStorage.setItem('rnk-veil-toast-density', window.toastDensityState);
}

function setToastDensityState(mode) {
    window.toastDensityState = mode;
    saveToastDensityState();
    applyToastDensityState();
}

function savePerformancePanelDensityState() {
    localStorage.setItem('rnk-veil-performance-panel-density', window.performancePanelDensityState);
}

window.applyPerformancePanelDensityState = function applyPerformancePanelDensityState() {
    const panel = document.getElementById('performance-panel');
    const state = document.getElementById('settings-performance-density-state');
    const shellBtn = document.getElementById('settings-performance-density-shell');
    const roomyBtn = document.getElementById('settings-performance-density-roomy');
    const compactBtn = document.getElementById('settings-performance-density-compact');
    const effectiveCompact =
        window.performancePanelDensityState === 'compact' ||
        (window.performancePanelDensityState === 'shell' && window.shellDensityState === 'compact');

    if (panel) {
        panel.classList.toggle('compact', effectiveCompact);
    }

    window.syncDensityToggleGroup(window.performancePanelDensityState, state, shellBtn, roomyBtn, compactBtn);
}

function setPerformancePanelDensityState(mode) {
    window.performancePanelDensityState = mode;
    savePerformancePanelDensityState();
    window.applyPerformancePanelDensityState();
}

function saveSearchProviderDensityState() {
    localStorage.setItem('rnk-veil-search-provider-density', window.searchProviderDensityState);
}

function applySearchProviderDensityState() {
    const panel = document.getElementById('search-provider-modal')?.querySelector('.search-provider-panel');
    const state = document.getElementById('settings-search-provider-density-state');
    const shellBtn = document.getElementById('settings-search-provider-density-shell');
    const roomyBtn = document.getElementById('settings-search-provider-density-roomy');
    const compactBtn = document.getElementById('settings-search-provider-density-compact');
    const effectiveCompact =
        window.searchProviderDensityState === 'compact' ||
        (window.searchProviderDensityState === 'shell' && window.shellDensityState === 'compact');

    if (panel) {
        panel.classList.toggle('search-provider-compact', effectiveCompact);
        panel.classList.toggle('search-provider-roomy', window.searchProviderDensityState === 'roomy');
    }

    window.syncDensityToggleGroup(window.searchProviderDensityState, state, shellBtn, roomyBtn, compactBtn);
}

function setSearchProviderDensityState(mode) {
    window.searchProviderDensityState = mode;
    saveSearchProviderDensityState();
    applySearchProviderDensityState();
}

function saveSessionsDensityState() {
    localStorage.setItem('rnk-veil-sessions-density', window.sessionsDensityState);
}

function applySessionsDensityState() {
    const panels = document.querySelectorAll('#recently-closed-modal .sessions-history-panel, #sessions-modal .sessions-history-panel');
    const state = document.getElementById('settings-sessions-density-state');
    const shellBtn = document.getElementById('settings-sessions-density-shell');
    const roomyBtn = document.getElementById('settings-sessions-density-roomy');
    const compactBtn = document.getElementById('settings-sessions-density-compact');
    const effectiveCompact =
        window.sessionsDensityState === 'compact' || (window.sessionsDensityState === 'shell' && window.shellDensityState === 'compact');

    panels.forEach((panel) => {
        panel.classList.toggle('sessions-history-compact', effectiveCompact);
        panel.classList.toggle('sessions-history-roomy', window.sessionsDensityState === 'roomy');
    });

    window.syncDensityToggleGroup(window.sessionsDensityState, state, shellBtn, roomyBtn, compactBtn);
}

function setSessionsDensityState(mode) {
    window.sessionsDensityState = mode;
    saveSessionsDensityState();
    applySessionsDensityState();
}

function applyBookmarksBarDensityState() {
    const bar = document.getElementById('bookmarks-bar');
    const state = document.getElementById('settings-bookmarks-bar-density-state');
    const shellBtn = document.getElementById('settings-bookmarks-bar-density-shell');
    const roomyBtn = document.getElementById('settings-bookmarks-bar-density-roomy');
    const compactBtn = document.getElementById('settings-bookmarks-bar-density-compact');
    if (!bar) return;
    const compact =
        window.bookmarksBarDensityState === 'compact' ||
        (window.bookmarksBarDensityState === 'shell' && window.shellDensityState === 'compact');
    const roomy = window.bookmarksBarDensityState === 'roomy';
    bar.classList.toggle('compact', compact);
    bar.classList.toggle('roomy', roomy);

    window.syncDensityToggleGroup(window.bookmarksBarDensityState, state, shellBtn, roomyBtn, compactBtn);
}

function applyBookmarksBarVisibilityState() {
    window.renderBookmarksBar();
    applyBookmarksBarDensityState();
}

function saveBookmarksBarDensityState() {
    localStorage.setItem('rnk-veil-bookmarks-bar-density', window.bookmarksBarDensityState);
}

function setBookmarksBarDensityState(mode) {
    window.bookmarksBarDensityState = mode;
    saveBookmarksBarDensityState();
    applyBookmarksBarDensityState();
}

// VEIL Sidebar density controls removed with the VEIL SHELL sidebar DOM.
// window.veilSidebarDensityState is kept (initialized in density-core.js) so
// saved prefs and persisted settings don't break.


window.applyDensityDependentSurfaces = applyDensityDependentSurfaces;






















window.toggleShellDensity = toggleShellDensity;
window.applyDensityDependentSurfaces = applyDensityDependentSurfaces;
window.isShortcutsEffectivelyDense = isShortcutsEffectivelyDense;
window.toggleShortcutsDense = toggleShortcutsDense;

window.toggleShellDensity = toggleShellDensity;
window.applyDensityDependentSurfaces = applyDensityDependentSurfaces;
window.isShortcutsEffectivelyDense = isShortcutsEffectivelyDense;
window.applyShortcutsDenseState = applyShortcutsDenseState;
window.toggleShortcutsDense = toggleShortcutsDense;
window.saveShortcutsDensityState = saveShortcutsDensityState;
window.setShortcutsDensityState = setShortcutsDensityState;
window.applyToastDensityState = applyToastDensityState;
window.saveToastDensityState = saveToastDensityState;
window.setToastDensityState = setToastDensityState;
window.savePerformancePanelDensityState = savePerformancePanelDensityState;
window.setPerformancePanelDensityState = setPerformancePanelDensityState;
window.saveSearchProviderDensityState = saveSearchProviderDensityState;
window.applySearchProviderDensityState = applySearchProviderDensityState;
window.setSearchProviderDensityState = setSearchProviderDensityState;
window.saveSessionsDensityState = saveSessionsDensityState;
window.applySessionsDensityState = applySessionsDensityState;
window.setSessionsDensityState = setSessionsDensityState;
window.applyBookmarksBarDensityState = applyBookmarksBarDensityState;
window.applyBookmarksBarVisibilityState = applyBookmarksBarVisibilityState;
window.saveBookmarksBarDensityState = saveBookmarksBarDensityState;
window.setBookmarksBarDensityState = setBookmarksBarDensityState;

window.toggleShellDensity = toggleShellDensity;
window.applyDensityDependentSurfaces = applyDensityDependentSurfaces;
window.isShortcutsEffectivelyDense = isShortcutsEffectivelyDense;
window.applyShortcutsDenseState = applyShortcutsDenseState;
window.toggleShortcutsDense = toggleShortcutsDense;
window.saveShortcutsDensityState = saveShortcutsDensityState;
window.setShortcutsDensityState = setShortcutsDensityState;
window.applyToastDensityState = applyToastDensityState;
window.saveToastDensityState = saveToastDensityState;
window.setToastDensityState = setToastDensityState;
window.savePerformancePanelDensityState = savePerformancePanelDensityState;
window.setPerformancePanelDensityState = setPerformancePanelDensityState;
window.saveSearchProviderDensityState = saveSearchProviderDensityState;
window.applySearchProviderDensityState = applySearchProviderDensityState;
window.setSearchProviderDensityState = setSearchProviderDensityState;
window.saveSessionsDensityState = saveSessionsDensityState;
window.applySessionsDensityState = applySessionsDensityState;
window.setSessionsDensityState = setSessionsDensityState;
window.applyBookmarksBarDensityState = applyBookmarksBarDensityState;
window.applyBookmarksBarVisibilityState = applyBookmarksBarVisibilityState;
window.saveBookmarksBarDensityState = saveBookmarksBarDensityState;
window.setBookmarksBarDensityState = setBookmarksBarDensityState;
