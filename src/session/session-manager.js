/**
 * GENYSYS™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

class SessionManager {
    constructor() {
        this.sessions = this.loadSessions();
    }

    loadSessions() {
        try {
            const saved = localStorage.getItem('rnk-genysys-sessions') ?? localStorage.getItem('rnk-axis-sessions') ?? localStorage.getItem('rnk-atlas-sessions');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    }

    saveSessions() {
        localStorage.setItem('rnk-genysys-sessions', JSON.stringify(this.sessions));
    }

    saveSession(name, tabs) {
        this.sessions[name] = {
            tabs: tabs.map(tab => ({
                url: tab.url,
                title: tab.title,
                favicon: tab.favicon,
                pinned: tab.pinned
            })),
            timestamp: Date.now()
        };
        this.saveSessions();
    }

    loadSession(name) {
        return this.sessions[name];
    }

    deleteSession(name) {
        delete this.sessions[name];
        this.saveSessions();
    }

    listSessions() {
        return Object.keys(this.sessions).map(name => ({
            name,
            tabCount: this.sessions[name].tabs.length,
            timestamp: this.sessions[name].timestamp
        }));
    }
}

window.SessionManager = SessionManager;
export { SessionManager };
export default SessionManager;
