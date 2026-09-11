/**
 * Axis™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

window.appWindow = null;
window.invoke = null;

window.initTauriAPI = async function initTauriAPI() {
    // withGlobalTauri: true injects window.__TAURI__ in every build (dev and
    // production). Prefer it; the @tauri-apps/api ESM import only exists in
    // bundler builds and must never be what production depends on.
    if (window.__TAURI__?.invoke) {
        window.invoke = (cmd, args) => window.__TAURI__.invoke(cmd, args);
        const winApi = window.__TAURI__?.window;
        if (winApi) {
            // Tauri v1 global API exposes the current window via getCurrent().
            const current = winApi.getCurrent ? winApi.getCurrent() : winApi.appWindow;
            if (current) {
                window.appWindow = current;
                return true;
            }
        }
        // IPC works even if the window module is unavailable — keep stubs only
        // for direct window-object access (commands window_* are used below).
        window.appWindow = {
            minimize: () => window.invoke('window_minimize'),
            maximize: () => window.invoke('window_maximize'),
            unmaximize: () => window.invoke('window_maximize'),
            close: () => window.invoke('window_close'),
            isMaximized: async () => false,
        };
        return true;
    }

    try {
        const windowModule = await import('@tauri-apps/api/window');
        const tauriModule = await import('@tauri-apps/api/tauri');
        window.appWindow = windowModule.appWindow;
        window.invoke = tauriModule.invoke;
        console.log('Tauri API loaded successfully');
        return true;
    } catch (error) {
        console.error('Tauri API not available:', error);
        window.appWindow = {
            minimize: () => console.log('Minimize'),
            maximize: () => console.log('Maximize'),
            unmaximize: () => console.log('Unmaximize'),
            close: () => window.close(),
            isMaximized: async () => false
        };
        window.invoke = (cmd, args) => {
            console.log('Invoke:', cmd, args);
            return Promise.resolve({ success: true });
        };
        return false;
    }
};
