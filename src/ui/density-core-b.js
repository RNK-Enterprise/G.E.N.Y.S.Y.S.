/**
 * GENYSYS™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */
function toggleOmniboxCompact() {
    const effectiveCompact = window.omniboxDensityState === 'compact' || (window.omniboxDensityState === 'shell' && window.shellDensityState === 'compact');
    window.omniboxDensityState = effectiveCompact ? 'roomy' : 'compact';
    saveOmniboxDensityState();
    applyOmniboxCompactState();
    window.syncShellDensityStateFromSurfaces();
}

function saveOmniboxDensityState() {
    localStorage.setItem('rnk-genysys-omnibox-density', window.omniboxDensityState);
}

function setOmniboxDensityState(mode) {
    window.omniboxDensityState = mode;
    saveOmniboxDensityState();
    applyOmniboxCompactState();
    window.syncShellDensityStateFromSurfaces();
}

function applySettingsDenseState() {
    const panel = document.getElementById('settings-panel');
    const toggle = document.getElementById('settings-dense-toggle');
    const state = document.getElementById('settings-settings-density-state');
    const shellBtn = document.getElementById('settings-settings-density-shell');
    const roomyBtn = document.getElementById('settings-settings-density-roomy');
    const compactBtn = document.getElementById('settings-settings-density-compact');
    const dense =
        window.settingsPanelDensityState === 'compact' ||
        (window.settingsPanelDensityState === 'shell' && window.shellDensityState === 'compact');
    const roomy = window.settingsPanelDensityState === 'roomy';
    if (panel) {
        panel.classList.toggle('dense', dense);
        panel.classList.toggle('roomy', roomy);
    }

    if (toggle) {
        toggle.textContent = dense ? 'Roomy' : 'Dense';
        toggle.setAttribute('aria-expanded', String(!dense));
    }

    syncDensityToggleGroup(window.settingsPanelDensityState, state, shellBtn, roomyBtn, compactBtn);

    saveSettingsPanelDensityState();
    applySettingsDensityControls();
}

function toggleSettingsDense() {
    const effectiveDense =
        window.settingsPanelDensityState === 'compact' ||
        (window.settingsPanelDensityState === 'shell' && window.shellDensityState === 'compact');
    window.settingsPanelDensityState = effectiveDense ? 'roomy' : 'compact';
    saveSettingsPanelDensityState();
    applySettingsDenseState();
    window.syncShellDensityStateFromSurfaces();
}

function saveSettingsPanelDensityState() {
    localStorage.setItem('rnk-genysys-settings-panel-density', window.settingsPanelDensityState);
}

function setSettingsPanelDensityState(mode) {
    window.settingsPanelDensityState = mode;
    saveSettingsPanelDensityState();
    applySettingsDenseState();
    window.syncShellDensityStateFromSurfaces();
}

function saveModalDensityState() {
    localStorage.setItem('rnk-genysys-modal-density', window.modalDensityState);
}

function setModalDensityState(mode) {
    window.modalDensityState = mode;
    saveModalDensityState();
    applyModalDensityState();
}

function saveLoadingDensityState() {
    localStorage.setItem('rnk-genysys-loading-density', window.loadingDensityState);
}

function setLoadingDensityState(mode) {
    window.loadingDensityState = mode;
    saveLoadingDensityState();
    window.applyLoadingDensityState();
}

function applyStatusbarMinimalState() {
    const statusbar = document.getElementById('statusbar');
    const statusText = document.getElementById('status-text');
    const toggle = document.getElementById('statusbar-minimal-toggle');
    const state = document.getElementById('settings-statusbar-density-state');
    const shellBtn = document.getElementById('settings-statusbar-density-shell');
    const roomyBtn = document.getElementById('settings-statusbar-density-roomy');
    const compactBtn = document.getElementById('settings-statusbar-density-compact');
    const minimal =
        window.statusbarDensityState === 'compact' ||
        (window.statusbarDensityState === 'shell' && window.shellDensityState === 'compact');
    const roomy = window.statusbarDensityState === 'roomy';
    if (statusbar) {
        statusbar.classList.toggle('minimal', minimal);
        statusbar.classList.toggle('roomy', roomy);
    }

    if (statusText) {
        statusText.classList.toggle('hidden', minimal);
    }

    if (toggle) {
        toggle.textContent = minimal ? 'Full' : 'Mini';
        toggle.setAttribute('aria-expanded', String(!minimal));
    }

    syncDensityToggleGroup(window.statusbarDensityState, state, shellBtn, roomyBtn, compactBtn);
}

function toggleStatusbarMinimal() {
    const effectiveMinimal = window.statusbarDensityState === 'compact' || (window.statusbarDensityState === 'shell' && window.shellDensityState === 'compact');
    window.statusbarDensityState = effectiveMinimal ? 'roomy' : 'compact';
    saveStatusbarDensityState();
    applyStatusbarMinimalState();
    window.syncShellDensityStateFromSurfaces();
}

function saveStatusbarDensityState() {
    localStorage.setItem('rnk-genysys-statusbar-density', window.statusbarDensityState);
}

function setStatusbarDensityState(mode) {
    window.statusbarDensityState = mode;
    saveStatusbarDensityState();
    applyStatusbarMinimalState();
    window.syncShellDensityStateFromSurfaces();
}

function applyTitlebarCompactState() {
    const titlebar = document.getElementById('titlebar');
    const windowTitle = document.querySelector('.window-title');
    const titlebarLeft = document.querySelector('.titlebar-left');
    const toggle = document.getElementById('titlebar-compact-toggle');
    const state = document.getElementById('settings-titlebar-density-state');
    const shellBtn = document.getElementById('settings-titlebar-density-shell');
    const roomyBtn = document.getElementById('settings-titlebar-density-roomy');
    const compactBtn = document.getElementById('settings-titlebar-density-compact');
    const compact =
        window.titlebarDensityState === 'compact' ||
        (window.titlebarDensityState === 'shell' && window.shellDensityState === 'compact');
    const roomy = window.titlebarDensityState === 'roomy';
    if (titlebar) {
        titlebar.classList.toggle('compact', compact);
        titlebar.classList.toggle('roomy', roomy);
    }

    if (windowTitle) {
        windowTitle.classList.toggle('hidden', compact);
    }

    if (titlebarLeft) {
        titlebarLeft.classList.toggle('compact', compact);
    }

    if (toggle) {
        toggle.textContent = compact ? 'Full' : 'Zen';
        toggle.setAttribute('aria-expanded', String(!compact));
    }

    syncDensityToggleGroup(window.titlebarDensityState, state, shellBtn, roomyBtn, compactBtn);
}

function toggleTitlebarCompact() {
    const effectiveCompact = window.titlebarDensityState === 'compact' || (window.titlebarDensityState === 'shell' && window.shellDensityState === 'compact');
    window.titlebarDensityState = effectiveCompact ? 'roomy' : 'compact';
    saveTitlebarDensityState();
    applyTitlebarCompactState();
    window.syncShellDensityStateFromSurfaces();
}

function saveTitlebarDensityState() {
    localStorage.setItem('rnk-genysys-titlebar-density', window.titlebarDensityState);
}

function setTitlebarDensityState(mode) {
    window.titlebarDensityState = mode;
    saveTitlebarDensityState();
    applyTitlebarCompactState();
    window.syncShellDensityStateFromSurfaces();
}

function saveShellDensityState() {
    localStorage.setItem('rnk-genysys-shell-density', window.shellDensityState);
}

function updateShellDensityToggleLabel() {
    const toggle = document.getElementById('shell-density-toggle');
    const settingsState = document.getElementById('settings-shell-density-state');
    const roomyBtn = document.getElementById('settings-shell-density-roomy');
    const compactBtn = document.getElementById('settings-shell-density-compact');
    const customBtn = document.getElementById('settings-shell-density-custom');
    if (!toggle && !settingsState && !roomyBtn && !compactBtn && !customBtn) return;

    switch (window.shellDensityState) {
        case 'compact':
            if (toggle) {
                toggle.textContent = 'Roomy All';
                toggle.setAttribute('aria-expanded', 'false');
            }
            if (settingsState) settingsState.textContent = 'Compact';
            if (roomyBtn) roomyBtn.setAttribute('aria-pressed', 'false');
            if (compactBtn) compactBtn.setAttribute('aria-pressed', 'true');
            if (customBtn) customBtn.setAttribute('aria-pressed', 'false');
            break;
        case 'roomy':
            if (toggle) {
                toggle.textContent = 'Compact All';
                toggle.setAttribute('aria-expanded', 'true');
            }
            if (settingsState) settingsState.textContent = 'Roomy';
            if (roomyBtn) roomyBtn.setAttribute('aria-pressed', 'true');
            if (compactBtn) compactBtn.setAttribute('aria-pressed', 'false');
            if (customBtn) customBtn.setAttribute('aria-pressed', 'false');
            break;
        default:
            if (toggle) {
                toggle.textContent = 'Set Density';
                toggle.setAttribute('aria-expanded', 'mixed');
            }
            if (settingsState) settingsState.textContent = 'Custom';
            if (roomyBtn) roomyBtn.setAttribute('aria-pressed', 'mixed');
            if (compactBtn) compactBtn.setAttribute('aria-pressed', 'mixed');
            if (customBtn) customBtn.setAttribute('aria-pressed', 'true');
            break;
    }
}

function applySettingsDensityControls() {
    const roomyBtn = document.getElementById('settings-shell-density-roomy');
    const compactBtn = document.getElementById('settings-shell-density-compact');
    const customBtn = document.getElementById('settings-shell-density-custom');
    syncActiveButtons(window.shellDensityState, [
        [roomyBtn, 'roomy'],
        [compactBtn, 'compact'],
        [customBtn, 'custom']
    ]);

    const settingsShellBtn = document.getElementById('settings-settings-density-shell');
    const settingsRoomyBtn = document.getElementById('settings-settings-density-roomy');
    const settingsCompactBtn = document.getElementById('settings-settings-density-compact');
    syncDensityToggleGroup(window.settingsPanelDensityState, null, settingsShellBtn, settingsRoomyBtn, settingsCompactBtn);
}




















































window.applySettingsDensityControls = applySettingsDensityControls;

window.toggleOmniboxCompact = toggleOmniboxCompact;
window.toggleSettingsDense = toggleSettingsDense;
window.toggleStatusbarMinimal = toggleStatusbarMinimal;
window.toggleTitlebarCompact = toggleTitlebarCompact;
window.updateShellDensityToggleLabel = updateShellDensityToggleLabel;
window.applySettingsDensityControls = applySettingsDensityControls;

window.toggleOmniboxCompact = toggleOmniboxCompact;
window.saveOmniboxDensityState = saveOmniboxDensityState;
window.setOmniboxDensityState = setOmniboxDensityState;
window.applySettingsDenseState = applySettingsDenseState;
window.toggleSettingsDense = toggleSettingsDense;
window.saveSettingsPanelDensityState = saveSettingsPanelDensityState;
window.setSettingsPanelDensityState = setSettingsPanelDensityState;
window.saveModalDensityState = saveModalDensityState;
window.setModalDensityState = setModalDensityState;
window.saveLoadingDensityState = saveLoadingDensityState;
window.setLoadingDensityState = setLoadingDensityState;
window.applyStatusbarMinimalState = applyStatusbarMinimalState;
window.toggleStatusbarMinimal = toggleStatusbarMinimal;
window.saveStatusbarDensityState = saveStatusbarDensityState;
window.setStatusbarDensityState = setStatusbarDensityState;
window.applyTitlebarCompactState = applyTitlebarCompactState;
window.toggleTitlebarCompact = toggleTitlebarCompact;
window.saveTitlebarDensityState = saveTitlebarDensityState;
window.setTitlebarDensityState = setTitlebarDensityState;
window.saveShellDensityState = saveShellDensityState;
window.updateShellDensityToggleLabel = updateShellDensityToggleLabel;
window.applySettingsDensityControls = applySettingsDensityControls;
