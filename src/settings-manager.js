/**
 * RNK Axis™
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 * 
 * Settings Manager
 */

export class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('rnk-axis-settings') ?? localStorage.getItem('rnk-atlas-settings');
            const settings = saved ? JSON.parse(saved) : this.getDefaultSettings();

            if (settings.performance) {
                const legacyPerformanceKey = ['enable', 'V', 'Q', 'Engines'].join('');
                if (settings.performance.enableAxisEngines === undefined && settings.performance[legacyPerformanceKey] !== undefined) {
                    settings.performance.enableAxisEngines = settings.performance[legacyPerformanceKey];
                }
                delete settings.performance[legacyPerformanceKey];
            }

            return settings;
        } catch {
            return this.getDefaultSettings();
        }
    }

    getDefaultSettings() {
        return {
            general: {
                homepage: 'axis://newtab',
                searchEngine: 'duckduckgo',
                newTabBehavior: 'homepage',
                showBookmarksBar: true
            },
            appearance: {
                theme: 'dark-neutral',
                fontSize: 'medium',
                showStatusBar: true,
                enableAnimations: true,
                accentColor: '#39ff14'
            },
            privacy: {
                enableTracking: false,
                clearHistoryOnExit: false,
                blockThirdPartyCookies: true,
                enableDNT: true,
                savePasswords: false
            },
            performance: {
                enableHardwareAcceleration: true,
                enableAxisEngines: true,
                preloadPages: false,
                maxCacheSize: 500
            },
            advanced: {
                enableDevTools: true,
                enableExperimentalFeatures: true,
                customUserAgent: '',
                proxyServer: ''
            }
        };
    }

    saveSettings() {
        try {
            localStorage.setItem('rnk-axis-settings', JSON.stringify(this.settings));
            this.emitEvent('settings-changed', this.settings);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    get(category, key) {
        return this.settings[category]?.[key];
    }

    set(category, key, value) {
        if (this.settings[category]) {
            this.settings[category][key] = value;
            this.saveSettings();
        }
    }

    getAll() {
        return this.settings;
    }

    reset() {
        this.settings = this.getDefaultSettings();
        this.saveSettings();
    }

    exportSettings() {
        return JSON.stringify(this.settings, null, 2);
    }

    importSettings(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.settings = { ...this.getDefaultSettings(), ...imported };
            this.saveSettings();
            return true;
        } catch {
            return false;
        }
    }

    emitEvent(eventName, data) {
        window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }
}

export default SettingsManager;
