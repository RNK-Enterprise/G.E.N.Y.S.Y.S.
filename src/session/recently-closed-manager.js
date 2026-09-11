/**
 * Axis™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

class RecentlyClosedManager {
    constructor() {
        this.closedTabs = this.loadClosedTabs();
        this.maxHistory = 20;
    }

    loadClosedTabs() {
        try {
            const saved = localStorage.getItem('rnk-axis-closed-tabs') ?? localStorage.getItem('rnk-atlas-closed-tabs');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }

    saveClosedTabs() {
        localStorage.setItem('rnk-axis-closed-tabs', JSON.stringify(this.closedTabs));
    }

    addClosedTab(tab) {
        this.closedTabs.unshift({
            url: tab.url,
            title: tab.title,
            favicon: tab.favicon,
            timestamp: Date.now()
        });
        
        // Keep only last N tabs
        if (this.closedTabs.length > this.maxHistory) {
            this.closedTabs = this.closedTabs.slice(0, this.maxHistory);
        }
        
        this.saveClosedTabs();
    }

    getRecentlyClosed() {
        return this.closedTabs;
    }

    clearHistory() {
        this.closedTabs = [];
        this.saveClosedTabs();
    }
}

window.RecentlyClosedManager = RecentlyClosedManager;
export { RecentlyClosedManager };
export default RecentlyClosedManager;
