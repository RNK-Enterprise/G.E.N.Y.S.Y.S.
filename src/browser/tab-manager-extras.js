/**
 * GENYSYS™ — TabManager extras (window mode)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Window-mode companions to tab-manager.js: tab lifecycle through Rust
 * (close_tab destroys the WebviewWindow), activation (show/hide windows),
 * history actions, and same-origin refusal views rendered in the shell's
 * content area when policy blocks a load (no tab window exists then).
 */
import TabManager from './tab-manager.js';

function hasTauri() {
    return Boolean(window.__TAURI__?.invoke);
}

TabManager.prototype.loadFavicon = function(tab) {
    try {
        const url = new URL(tab.url);
        const faviconUrl = `${url.origin}/favicon.ico`;
        const img = new Image();
        img.onload = () => {
            tab.favicon = faviconUrl;
            this.renderTabs();
            this.saveTabs();
        };
        img.onerror = () => { tab.favicon = null; };
        img.src = faviconUrl;
    } catch (e) {
        tab.favicon = null;
    }
};

TabManager.prototype.saveTabs = function() {
    const tabsData = this.tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        favicon: tab.favicon,
        pinned: tab.pinned
    }));
    localStorage.setItem('rnk-genysys-tabs', JSON.stringify({
        tabs: tabsData,
        activeIndex: this.tabs.findIndex(t => t.id === this.activeTabId)
    }));
};

TabManager.prototype.restoreTabs = function() {
    try {
        const saved = localStorage.getItem('rnk-genysys-tabs') ?? localStorage.getItem('rnk-axis-tabs') ?? localStorage.getItem('rnk-atlas-tabs');
        if (!saved) return false;

        const data = JSON.parse(saved);
        if (!data.tabs || data.tabs.length === 0) return false;

        // Idempotent: never restore on top of an existing session
        if (this.tabs.length > 0) return true;

        const MVE_RESTORE = 20;
        const toRestore = data.tabs.slice(0, MVE_RESTORE);
        toRestore.forEach((tabData) => {
            try {
                const tab = this.createTab(tabData.url);
                if (!tab) return;
                // One status-bar credit per restored navigation: its async
                // policy round-trip may not clobber the “Viewing …” status
                // the sync activateTab already wrote (the user navigated
                // nowhere — no transient “Loading” belongs in the status bar).
                // The credit is kept until the navigation settles
                // (genysys:navigate / policy block), not consumed on first use.
                if (tabData.url && tabData.url !== 'genysys://newtab' && tabData.url !== 'about:blank') {
                    this._restoreCredits.set(tab.id, true);
                }
                // Restore the session's memory, not a placeholder: a saved
                // title comes back as that title (createTab stamps a
                // 'Loading...' placeholder for non-newtab URLs).
                if (tabData.title) tab.title = tabData.title;
                if (tabData.favicon) tab.favicon = tabData.favicon;
                if (tabData.pinned) tab.pinned = true;
            } catch (err) {
                console.warn('Tab restore: skipping broken tab', err);
            }
        });

        if (data.activeIndex >= 0 && data.activeIndex < toRestore.length && this.tabs.length > 0) {
            this.activateTab(this.tabs[Math.min(data.activeIndex, this.tabs.length - 1)].id);
        }

        return true;
    } catch (e) {
        console.error('Failed to restore tabs:', e);
        return false;
    }
};

TabManager.prototype.pinTab = function(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
        tab.pinned = !tab.pinned;
        this.renderTabs();
        this.saveTabs();
        window.refreshGENYSYSSidebarFeeds();
    }
};

TabManager.prototype.handleDragStart = function(e, tabId) {
    this.draggedTabId = tabId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
    e.target.classList.add('dragging');
};

TabManager.prototype.handleDragOver = function(e, targetTabId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const draggedTab = this.tabs.find(t => t.id === this.draggedTabId);
    const targetTab = this.tabs.find(t => t.id === targetTabId);

    if (!draggedTab || !targetTab) return;
    if (draggedTab.pinned !== targetTab.pinned) return;

    const targetElement = e.currentTarget;
    const rect = targetElement.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;

    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('drop-left', 'drop-right');
    });

    if (e.clientX < midpoint) {
        targetElement.classList.add('drop-left');
    } else {
        targetElement.classList.add('drop-right');
    }
};

TabManager.prototype.handleDrop = function(e, targetTabId) {
    e.preventDefault();
    e.stopPropagation();

    const draggedTab = this.tabs.find(t => t.id === this.draggedTabId);
    const targetTab = this.tabs.find(t => t.id === targetTabId);

    if (!draggedTab || !targetTab || draggedTab.id === targetTab.id) return;
    if (draggedTab.pinned !== targetTab.pinned) return;

    const draggedIndex = this.tabs.findIndex(t => t.id === this.draggedTabId);
    this.tabs.splice(draggedIndex, 1);
    const newTargetIndex = this.tabs.findIndex(t => t.id === targetTabId);

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const insertIndex = e.clientX < midpoint ? newTargetIndex : newTargetIndex + 1;

    this.tabs.splice(insertIndex, 0, draggedTab);

    this.renderTabs();
    this.saveTabs();
};

TabManager.prototype.handleDragEnd = function(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('drop-left', 'drop-right');
    });
    this.draggedTabId = null;
};

TabManager.prototype.closeTab = function(tabId) {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const tab = this.tabs[index];

    if (this.tabs.length > 1) {
        window.recentlyClosedManager?.addClosedTab(tab);
    }

    // Rust destroys the WebviewWindow (no-op if it never existed).
    if (hasTauri()) {
        window.tauriInvoke?.('close_tab', { tabId }).catch(() => {});
    }

    this.tabs.splice(index, 1);
    this.blockedViews.delete(tabId);
    this.hideBlockedView();

    if (this.tabs.length === 0) {
        this.createTab();
    } else if (this.activeTabId === tabId) {
        const newIndex = Math.min(index, this.tabs.length - 1);
        this.activateTab(this.tabs[newIndex].id);
    }

    this.renderTabs();
    this.saveTabs();
};

TabManager.prototype.activateTab = function(tabId) {
    this.activeTabId = tabId;
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
        document.getElementById('omnibox').value =
            tab.blockedView ? (tab.blockedView.domain || tab.url) : tab.url;
        window.updateStatusBar(`Viewing ${tab.title}`);
        window.dispatchEvent(new CustomEvent('genysys:tab-activated', { detail: { tab } }));
    }
    this.tabs.forEach(other => {
        if (other.id !== tabId) {
            window.dispatchEvent(new CustomEvent('genysys:tab-deactivated', {
                detail: { tab: other, activeId: tabId },
            }));
        }
    });

    // Window-mode: show this tab's window, hide the others.
    if (hasTauri()) {
        window.tauriInvoke?.('tab_window_activate', { tabId }).catch(() => {});
    }
    if (tab && tab.blockedView) {
        this.renderBlockedView(tab);
    } else {
        this.hideBlockedView();
    }
    this.renderTabs();
    this.saveTabs();
    this.syncContentRect(tabId);
    window.refreshGENYSYSSidebarFeeds();
};

TabManager.prototype.renderTabs = function() {
    const tabsContainer = document.getElementById('tabs');
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';
    tabsContainer.setAttribute('role', 'tablist');
    tabsContainer.setAttribute('aria-label', 'Browser tabs');

    const sortedTabs = [...this.tabs].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
    });

    sortedTabs.forEach((tab, index) => {
        const tabElement = document.createElement('div');
        const isActive = tab.id === this.activeTabId;
        tabElement.className = `tab ${isActive ? 'active' : ''} ${tab.pinned ? 'pinned' : ''}`;
        tabElement.setAttribute('data-tab-id', tab.id);
        tabElement.setAttribute('draggable', 'true');
        tabElement.setAttribute('role', 'tab');
        tabElement.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tabElement.setAttribute('aria-label', `${tab.title} - ${tab.url}`);
        tabElement.setAttribute('tabindex', isActive ? '0' : '-1');

        const favicon = tab.favicon ?
            `<img src="${tab.favicon}" class="tab-favicon" alt="" onerror="this.style.display='none'">` :
            '<span class="tab-favicon" aria-hidden="true">WEB</span>';

        const pinIndicator = tab.pinned ? '<span class="pin-indicator" aria-label="Pinned tab">PIN</span>' : '';

        tabElement.innerHTML = `
            ${favicon}
            ${pinIndicator}
            <span class="tab-title">${tab.title}</span>
            <button class="tab-close" data-tab-id="${tab.id}" aria-label="Close ${tab.title}" tabindex="0">×</button>
        `;

        window.bindTabElementInteractions(tabElement, tab, index, sortedTabs, this);

        tabsContainer.appendChild(tabElement);
    });
};

TabManager.prototype.updateTab = function(tabId, updates) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
        Object.assign(tab, updates);
        this.renderTabs();
        window.refreshGENYSYSSidebarFeeds();
    }
};

TabManager.prototype.navigateActiveTab = function(url) {
    this.navigateTab(this.activeTabId, url);
};

TabManager.prototype.navigateTab = function(tabId, url) {
    // A user-driven navigation always owns the status bar: drop any leftover
    // restore credit for this tab before the round-trip starts.
    this._restoreCredits?.delete(tabId);
    const normalized = window.normalizeUrl(url);
    window.navigateWithLISA(
        tabId,
        normalized,
        (finalUrl) => this.onPolicyAllowed(tabId, finalUrl),
        (policy) => this.onPolicyBlocked(tabId, policy),
    );
};

/** History actions run inside the tab window (Rust-evaluated, whitelisted). */
TabManager.prototype.historyAction = function(tabId, action) {
    if (!hasTauri()) return;
    window.tauriInvoke?.('tab_window_history', { tabId, action }).catch(() => {});
};

TabManager.prototype.goBack = function() {
    this.historyAction(this.activeTabId, 'back');
};

TabManager.prototype.goForward = function() {
    this.historyAction(this.activeTabId, 'forward');
};

TabManager.prototype.refresh = function() {
    this.historyAction(this.activeTabId, 'reload');
    window.updateStatusBar('Refreshing...');
};

// ── Refusal views (policy blocked → no window exists) ────────────────────────

TabManager.prototype.renderBlockedView = function(tab) {
    if (!tab || !tab.blockedView) return;
    const { view, reason, domain } = tab.blockedView;
    const params = new URLSearchParams({ view, reason, domain });
    let frame = document.getElementById('genysys-blocked-view');
    if (!frame) {
        frame = document.createElement('iframe');
        frame.id = 'genysys-blocked-view';
        frame.className = 'webview';
        frame.setAttribute('role', 'document');
        frame.setAttribute('aria-label', 'Policy notice');
        (this.webviewContainer || document.body).appendChild(frame);
    }
    // Same-origin app page — carries no navigation, only the refusal text.
    frame.src = `/newtab.html?${params.toString()}`;
    frame.style.display = 'block';
};

TabManager.prototype.hideBlockedView = function() {
    const frame = document.getElementById('genysys-blocked-view');
    if (frame) frame.remove();
};

TabManager.prototype.showTabContextMenu = function(tabId, x, y) {
    const existing = document.getElementById('tab-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'tab-context-menu';
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    menu.innerHTML = `
        <div class="context-menu-item" data-action="pin">${tab.pinned ? 'Unpin' : 'Pin'} Tab</div>
        <div class="context-menu-item" data-action="duplicate">Duplicate Tab</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="close-others">Close Other Tabs</div>
        <div class="context-menu-item" data-action="close-right">Close Tabs to Right</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="close">Close Tab</div>
    `;

    document.body.appendChild(menu);
    window.bindItemEvents(menu.querySelectorAll('.context-menu-item'), {
        click: (item) => {
            const action = item.dataset.action;
            if (action) {
                this.handleContextMenuAction(tabId, action);
                menu.remove();
            }
        }
    });

    setTimeout(() => {
        document.addEventListener('click', () => menu.remove(), { once: true });
    }, 0);
};

TabManager.prototype.handleContextMenuAction = function(tabId, action) {
    switch(action) {
        case 'pin':
            this.pinTab(tabId);
            break;
        case 'duplicate':
            const tab = this.tabs.find(t => t.id === tabId);
            if (tab) this.createTab(tab.url);
            break;
        case 'close-others':
            this.tabs.filter(t => t.id !== tabId && !t.pinned).forEach(t => this.closeTab(t.id));
            break;
        case 'close-right':
            const index = this.tabs.findIndex(t => t.id === tabId);
            if (index < 0) break;
            this.tabs.slice(index + 1).filter(t => !t.pinned).forEach(t => this.closeTab(t.id));
            break;
        case 'close':
            this.closeTab(tabId);
            break;
    }
};

window.TabManager = TabManager;
