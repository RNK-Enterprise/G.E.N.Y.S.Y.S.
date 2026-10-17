/**
 * GENYSYS™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Window-mode TabManager: each tab's content is a real Tauri WebviewWindow
 * created by the Rust side AFTER P.R.O.T.E.C.T.S. policy allows the URL.
 * The shell keeps only the chrome (tab bar, omnibox, status). Iframes are
 * gone — webviews render better and carry the GENYSYS attestation cookie.
 *
 * The frontend can never load a URL itself: it asks `navigate_tab`, and the
 * Rust gate either creates/reuses the tab window or returns block.
 */

import { normalizeUrl, navigateWithPolicy } from '../policy-bridge.js';

class TabManager {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.nextTabId = 1;
        // Tab ids with a pending restore-initiated navigation: their policy
        // round-trips may not clobber the “Viewing …” status with a transient
        // “Loading” (the user navigated nowhere at boot).
        this._restoreCredits = new Map();
        this.webviewContainer = document.getElementById('webview-container');
        // Window-mode state (no DOM nodes per tab).
        this.blockedViews = new Map(); // tabId -> { view, reason, domain }
        this._rectRaf = null;
    }

    createTab(url = 'genysys://newtab') {
        const tabId = this.nextTabId++;

        const tab = {
            id: tabId,
            url: url,
            title: url === 'genysys://newtab' ? 'New Tab' : 'Loading...',
            favicon: null,
            pinned: false,
            blockedView: null,
        };
        this.tabs.push(tab);
        this.renderTabs();
        this.saveTabs();

        if (url === 'about:blank') {
            this.activateTab(tabId);
        } else {
            this.activateTab(tabId);
            const resolved = window.normalizeUrl(url);
            window.navigateWithPolicy(
                tabId,
                resolved,
                (finalUrl) => this.onPolicyAllowed(tabId, finalUrl),
                (policy) => this.onPolicyBlocked(tabId, policy),
            );
        }

        return tab;
    }

    /** Policy allow → Rust already created/reused the tab window. */
    onPolicyAllowed(tabId, url) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;
        tab.url = url;
        // Keep a meaningful restored title while the window loads; tab-meta
        // replaces it with the live page title. Fresh navigations keep the
        // 'Loading...' placeholder createTab stamped.
        if (url !== 'genysys://newtab' && (!tab.title || tab.title === 'New Tab')) {
            tab.title = 'Loading...';
        }
        tab.blockedView = null;
        this.renderTabs();
        this.saveTabs();
        window.refreshGENYSYSSidebarFeeds();
        // A restore-initiated round-trip must not clobber the “Viewing …”
        // status the sync activateTab already wrote. Credit is kept until the
        // navigation settles (genysys:navigate / block / a real navigateTab).
        if (!this._restoreCredits.has(tabId)) {
            window.updateStatusBar(url === 'genysys://newtab' ? 'Viewing New Tab' : `Loading ${url}...`);
        }
        this.syncContentRect(tabId);
    }

    /** Policy block → no window content; the chrome shows the refusal view. */
    onPolicyBlocked(tabId, policy) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;
        // A blocked restored URL keeps its honest “Blocked by P.R.O.T.E.C.T.S.”
        // status write below; settle the restore credit either way.
        this._restoreCredits.delete(tabId);
        const reason = policy?.reason || 'policy_violation';
        const isAccessReq = reason === 'domain_not_in_auth_list' || reason === 'tier_not_authorized';
        tab.blockedView = {
            view: isAccessReq ? 'access-request' : (policy?.quarantined ? 'quarantine' : 'block'),
            reason,
            domain: policy?.domain || tab.url,
        };
        this.blockedViews.set(tabId, tab.blockedView);
        tab.url = tab.url === 'genysys://newtab' ? tab.url : (policy?.domain || tab.url);
        tab.title = isAccessReq ? 'Access Request' : 'Blocked';
        this.renderTabs();
        this.saveTabs();
        window.updateStatusBar('Blocked by P.R.O.T.E.C.T.S.');
        if (this.toast && !isAccessReq) {
            this.toast.error('Blocked', reason, 4000);
        }
    }

    onTauriNavigate(tabId, url, _context, _chain) {
        // Rust emits genysys:navigate after creating/reusing the tab window.
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;
        tab.url = url;
        if (url !== 'genysys://newtab' && tab.title === 'New Tab') tab.title = 'Loading...';
        tab.blockedView = null;
        this.renderTabs();
        this.saveTabs();
        window.refreshGENYSYSSidebarFeeds();
        // Same restore rule as onPolicyAllowed; this event settles the tab's
        // credit (the invoke callback kept it through the allow).
        if (this._restoreCredits.has(tabId)) {
            this._restoreCredits.delete(tabId);
        } else {
            window.updateStatusBar(url === 'genysys://newtab' ? 'Viewing New Tab' : `Loading ${url}...`);
        }
        this.syncContentRect(tabId);
    }

    onTabMeta(tabId, meta) {
        // From the Rust watcher: real title/URL of the tab window.
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;
        if (meta.title) {
            tab.title = String(meta.title).slice(0, 120) || tab.title;
        }
        if (meta.url && !meta.url.startsWith('data:')) {
            tab.url = meta.url;
        }
        this.renderTabs();
        this.saveTabs();
        if (tabId === this.activeTabId) {
            const omnibox = document.getElementById('omnibox');
            if (omnibox && document.activeElement !== omnibox) {
                omnibox.value = tab.url;
            }
            window.updateStatusBar(tab.title);
        }
        window.refreshGENYSYSSidebarFeeds();
    }

    /**
     * Report the content rect to Rust so the tab window sits over
     * #webview-container. Uses rAF-debounce to survive resize storms.
     */
    syncContentRect(tabId) {
        if (this._rectRaf) cancelAnimationFrame(this._rectRaf);
        const id = tabId ?? this.activeTabId;
        this._rectRaf = requestAnimationFrame(() => {
            this._rectRaf = null;
            if (id == null || !window.__TAURI__?.invoke) return;
            const el = this.webviewContainer;
            if (!el) return;
            const r = el.getBoundingClientRect();
            window.__TAURI__.invoke('tab_window_sync_rect', {
                tabId: id,
                x: Math.round(r.left),
                y: Math.round(r.top + window.scrollY),
                width: Math.round(r.width),
                height: Math.round(r.height),
            }).catch(() => { /* window may not exist yet */ });
        });
    }

    setTabLoading(tabId, loading) {
        // Restore-initiated navigations keep the “Viewing …” status; the tab
        // badge still reflects the loading state below.
        if (loading && !this._restoreCredits.has(tabId)) window.updateStatusBar('Loading...');
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab) {
            tab.loading = !!loading;
            this.renderTabs();
        }
    }

    /** Internal page load inside a tab window (new-tab / internal views). */
    loadInternal(tabId, path) {
        window.tauriInvoke?.('tab_window_internal_load', { tabId, path }).catch(() => {});
    }
}

window.TabManager = TabManager;
export { TabManager };
export default TabManager;
