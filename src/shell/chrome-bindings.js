/**
 * GENYSYS™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import ToastManager from '../ui/toast.js';
import LoadingManager from '../ui/loading.js';
import PerformanceMonitor from '../perf/performance-monitor.js';
import { genysysRuntime } from '../engines/runtime.js';
import TabManager from '../browser/tab-manager.js';

// Early stubs — real impl in chrome-bindings-c.js
window.closeSettings = window.closeSettings || function closeSettings() {};
window.openSettings = window.openSettings || function openSettings() {};

window.TabManager = TabManager;
window.PerformanceMonitor = PerformanceMonitor;
window.genysysRuntime = genysysRuntime;
window.tabManager = new TabManager();
window.toastManager = new ToastManager();
window.loadingManager = new LoadingManager();
window.tabManager.toast = window.toastManager;
window.genysysBridge = genysysRuntime;

window.bindClickHandlers([
    ['new-tab-btn', () => {
        if (!window.isGENYSYSCapabilityAvailable('genysys-browser-core')) return;
        window.tabManager.createTab();
        window.toastManager.success('New Tab', 'Tab created successfully');
    }],
    ['recently-closed-btn', () => {
        if (!window.isGENYSYSCapabilityAvailable('genysys-history')) return;
        window.openRecentlyClosedView();
    }],
    ['sessions-btn', () => {
        if (!window.isGENYSYSCapabilityAvailable('genysys-browser-core')) return;
        window.openSessionsView();
    }],
    ['save-session-btn', () => {
        const nameInput = document.getElementById('session-name-input');
        const name = nameInput.value.trim();
        if (!name) {
            alert('Please enter a session name');
            return;
        }
        window.sessionManager.saveSession(name, window.tabManager.tabs);
        nameInput.value = '';
        updateStatusBar(`Session saved: ${name}`);
        showSessionsModal();
    }],
    ['search-provider-btn', () => {
        if (!window.isGENYSYSCapabilityAvailable('genysys-search')) return;
        window.openSearchProviderModal();
    }],
    ['close-settings', closeSettings],
    ['menu-btn', openSettings],
    ['clear-history-btn', () => {
        if (!window.isGENYSYSCapabilityAvailable('genysys-history')) return;
        if (confirm('Are you sure you want to clear your browsing history?')) {
            window.historyManager.clearHistory();
            updateStatusBar('Browsing history cleared');
        }
    }],
    ['reset-settings-btn', () => {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            window.settingsManager.reset();
            loadSettings();
            updateStatusBar('Settings reset to defaults');
        }
    }],
    ['fps-counter', () => {
        if (!window.isGENYSYSCapabilityAvailable('genysys-performance-stack')) return;
        window.togglePerformancePanel();
    }],
    ['performance-panel .modal-close', () => {
        if (!window.isGENYSYSCapabilityAvailable('genysys-performance-stack')) return;
        window.togglePerformancePanel();
    }]
]);

function bindDensityControlListeners() {
    const controls = [
        ['tab-bar-compact-toggle', () => {
            if (!window.isGENYSYSCapabilityAvailable('genysys-browser-core')) return;
            window.toggleTabBarCompact();
            updateStatusBar(window.isDensityEffectivelyCompact(window.tabBarDensityState) ? 'Tab bar compacted' : 'Tab bar expanded');
        }],
        ['omnibox-compact-toggle', () => {
            if (!window.isGENYSYSCapabilityAvailable('genysys-browser-core')) return;
            window.toggleOmniboxCompact();
            updateStatusBar(window.isDensityEffectivelyCompact(window.omniboxDensityState) ? 'Omnibox compacted' : 'Omnibox expanded');
        }],
        ['settings-dense-toggle', () => {
            window.toggleSettingsDense();
            updateStatusBar(window.isDensityEffectivelyCompact(window.settingsPanelDensityState) ? 'Settings set to dense' : 'Settings set to roomy');
        }],
        ['shortcuts-dense-toggle', () => {
            window.toggleShortcutsDense();
            updateStatusBar(window.isShortcutsEffectivelyDense() ? 'Shortcuts help set to dense' : 'Shortcuts help set to roomy');
        }],
        ['statusbar-minimal-toggle', () => {
            window.toggleStatusbarMinimal();
            updateStatusBar(window.isDensityEffectivelyCompact(window.statusbarDensityState) ? 'Status bar minimized' : 'Status bar expanded');
        }],
        ['titlebar-compact-toggle', () => {
            window.toggleTitlebarCompact();
            updateStatusBar(window.isDensityEffectivelyCompact(window.titlebarDensityState) ? 'Titlebar compacted' : 'Titlebar expanded');
        }],
        ['shell-density-toggle', () => {
            window.toggleShellDensity();
            updateStatusBar(window.shellDensityState === 'compact' ? 'Shell set to compact' : 'Shell set to roomy');
        }]
    ];

    window.settingsDensityControlConfigs.forEach(({ buttons }) => {
        buttons.forEach(({ id, handler }) => {
            controls.push([id, handler]);
        });
    });

    controls.forEach(([id, handler]) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', handler);
        }
    });
}

bindDensityControlListeners();

// Tab Search
window.tabSearch = document.getElementById('tab-search');
window.tabSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const tabs = document.querySelectorAll('.tab');
    let visibleCount = 0;
    
    tabs.forEach(tab => {
        const title = tab.querySelector('.tab-title').textContent.toLowerCase();
        const tabId = parseInt(tab.getAttribute('data-tab-id'));
        const tabData = window.tabManager.tabs.find(t => t.id === tabId);
        const url = tabData ? tabData.url.toLowerCase() : '';
        
        if (title.includes(query) || url.includes(query)) {
            tab.style.display = 'flex';
            visibleCount++;
        } else {
            tab.style.display = 'none';
        }
    });
    
    // Show result count tooltip
    if (query && visibleCount === 0) {
        window.toastManager.info('No Results', `No tabs found matching "${query}"`, 2000);
    }
});

window.SETTINGS_SECTION_COLLAPSIBLE.forEach(({ key, toggleId }) => {
    const toggle = document.getElementById(toggleId);
    if (!toggle) return;
    toggle.addEventListener('click', () => {
        window.toggleSettingsSection(key);
    });
});

window.addEventListener('history-updated', () => {
    window.refreshGENYSYSSidebarFeeds();
});
window.addEventListener('history-cleared', () => {
    window.refreshGENYSYSSidebarFeeds();
});
window.addEventListener('bookmark-added', () => {
    window.renderBookmarksBar();
});
window.addEventListener('bookmark-removed', () => {
    window.renderBookmarksBar();
});
window.addEventListener('download-started', (event) => {
    updateStatusBar(`Download started: ${event.detail?.filename || 'download'}`);
});
window.addEventListener('download-completed', (event) => {
    updateStatusBar(`Download completed: ${event.detail?.filename || 'download'}`);
});
window.addEventListener('download-paused', (event) => {
    updateStatusBar(`Download paused: ${event.detail?.filename || 'download'}`);
});
window.addEventListener('download-resumed', (event) => {
    updateStatusBar(`Download resumed: ${event.detail?.filename || 'download'}`);
});
window.addEventListener('download-cancelled', (event) => {
    updateStatusBar(`Download cancelled: ${event.detail?.filename || 'download'}`);
});

// Keyboard Shortcuts Help (? key)
document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const modal = document.getElementById('shortcuts-help');
        if (modal) {
            const hidden = !modal.classList.contains('hidden');
            window.setElementHidden(modal, hidden);
            if (!hidden) {
                window.applyShortcutsDenseState();
            }
        }
    }
});

// Modal close handlers

window.bindDensityControlListeners = bindDensityControlListeners;
