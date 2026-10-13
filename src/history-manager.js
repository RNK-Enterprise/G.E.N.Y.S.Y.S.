/**
 * RNK GENYSYS™
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 * 
 * History Manager
 */

export class HistoryManager {
    constructor() {
        this.history = this.loadHistory();
        this.maxEntries = 10000;
        this.lastId = Date.now();
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('rnk-genysys-history') ?? localStorage.getItem('rnk-axis-history') ?? localStorage.getItem('rnk-atlas-history');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }

    saveHistory() {
        try {
            localStorage.setItem('rnk-genysys-history', JSON.stringify(this.history));
        } catch (error) {
            console.error('Failed to save history:', error);
        }
    }

    addEntry(url, title) {
        const entry = {
            id: ++this.lastId,
            url: url,
            title: title || url,
            timestamp: Date.now(),
            visitCount: 1
        };

        const existing = this.history.find(h => h.url === url);
        if (existing) {
            existing.timestamp = Date.now();
            existing.visitCount++;
            existing.title = title || existing.title;
        } else {
            this.history.unshift(entry);
            if (this.history.length > this.maxEntries) {
                this.history = this.history.slice(0, this.maxEntries);
            }
        }

        this.saveHistory();
        this.emitEvent('history-updated', entry);
    }

    removeEntry(id) {
        this.history = this.history.filter(h => h.id !== id);
        this.saveHistory();
    }

    clearHistory() {
        this.history = [];
        this.saveHistory();
        this.emitEvent('history-cleared');
    }

    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.history.filter(h => 
            h.title.toLowerCase().includes(lowerQuery) ||
            h.url.toLowerCase().includes(lowerQuery)
        );
    }

    getRecent(limit = 50) {
        return this.history.slice(0, limit);
    }

    getByDate(date) {
        // Date-only strings are parsed as UTC; anchor to local noon first so
        // the local-day window below matches the caller's calendar day.
        const base = /^\d{4}-\d{2}-\d{2}$/.test(String(date))
            ? new Date(`${date}T12:00:00`)
            : new Date(date);
        const startOfDay = base.setHours(0, 0, 0, 0);
        const endOfDay = base.setHours(23, 59, 59, 999);
        return this.history.filter(h => h.timestamp >= startOfDay && h.timestamp <= endOfDay);
    }

    getMostVisited(limit = 10) {
        return [...this.history]
            .sort((a, b) => b.visitCount - a.visitCount)
            .slice(0, limit);
    }

    emitEvent(eventName, data) {
        window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }
}

export default HistoryManager;
