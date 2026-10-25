/**
 * GENYSYS Camofox capability bridge.
 *
 * Jess and other local shell agents use this typed surface instead of calling
 * the loopback Camofox service directly. Rust remains the policy authority.
 */

function activeTabId(tabId) {
    const resolved = tabId ?? window.tabManager?.activeTabId;
    if (!Number.isInteger(resolved) || resolved < 0) {
        throw new Error('camofox_active_tab_missing');
    }
    return resolved;
}

function invoke(command, args = {}) {
    if (typeof window.tauriInvoke !== 'function') {
        return Promise.reject(new Error('camofox_native_shell_required'));
    }
    return window.tauriInvoke(command, args);
}

const camofoxBrowser = Object.freeze({
    status: () => invoke('tab_window_status'),
    snapshot: (tabId, includeScreenshot = false) => invoke('camofox_snapshot', {
        tabId: activeTabId(tabId),
        includeScreenshot: Boolean(includeScreenshot),
    }),
    screenshot: (tabId) => invoke('camofox_screenshot', { tabId: activeTabId(tabId) }),
    links: (tabId, limit = 50, offset = 0) => invoke('camofox_links', {
        tabId: activeTabId(tabId), limit, offset,
    }),
    click: (tabId, reference, selector) => invoke('camofox_click', {
        tabId: activeTabId(tabId), reference, selector,
    }),
    type: (tabId, reference, selector, text, pressEnter = false) => invoke('camofox_type', {
        tabId: activeTabId(tabId), reference, selector, text, pressEnter: Boolean(pressEnter),
    }),
    press: (tabId, key) => invoke('camofox_press', { tabId: activeTabId(tabId), key }),
    wait: (tabId, timeout, waitForNetwork = true, dismissConsent = false) => invoke('camofox_wait', {
        tabId: activeTabId(tabId), timeout, waitForNetwork: Boolean(waitForNetwork),
        dismissConsent: Boolean(dismissConsent),
    }),
    scroll: (tabId, direction, amount = 500) => invoke('camofox_scroll', {
        tabId: activeTabId(tabId), direction, amount,
    }),
});

window.camofoxBrowser = camofoxBrowser;

export { activeTabId, camofoxBrowser };
