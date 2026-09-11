/**
 * Axis™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

window.setAxisSidebarStateBadge = function setAxisSidebarStateBadge(element, label, state = 'offline') {
    if (!element) return;
    element.textContent = label;
    element.dataset.state = state;
}

window.setAxisSidebarStateBadgeFromCapability = function setAxisSidebarStateBadgeFromCapability(element, capabilityId, availableLabel = null, availableState = null, unavailableLabel = 'Offline') {
    if (!element) return;
    const available = window.isAxisCapabilityAvailable(capabilityId);
    setAxisSidebarStateBadge(
        element,
        available
            ? (availableLabel ?? 'Ready')
            : unavailableLabel,
        available
            ? (availableState ?? 'ready')
            : 'offline'
    );
};

window.SETTINGS_SECTION_RULES = {
    general: ['browser', 'security', 'privacy'],
    appearance: ['productivity', 'extensions'],
    privacy: ['security', 'privacy'],
    performance: ['performance'],
    axis: [],
    advanced: ['developer', 'automation', 'accessibility']
};

window.AXIS_SURFACE_RULES = [
    { selector: '#search-provider-btn', capability: 'axis-search', mode: 'hide' },
    { selector: '#search-provider-modal', capability: 'axis-search', mode: 'hide' },
    { selector: '#bookmarks-bar', capability: 'axis-bookmarks', mode: 'hide' },
    { selector: '#bookmark-btn', capability: 'axis-bookmarks', mode: 'hide' },
    { selector: '#sessions-btn', capability: 'axis-browser-core', mode: 'hide' },
    { selector: '#performance-panel', capability: 'axis-performance-stack', mode: 'hide' },
    { selector: '#fps-counter', capability: 'axis-performance-stack', mode: 'hide' },
    { selector: '#clear-history-btn', capability: 'axis-history', mode: 'disable' },
    { selector: '#setting-clear-history', capability: 'axis-history', mode: 'disable' },
    { selector: '#setting-show-bookmarks-bar', capability: 'axis-bookmarks', mode: 'disable' },
    { selector: '#new-tab-btn', capability: 'axis-browser-core', mode: 'hide' },
    { selector: '#tab-bar', capability: 'axis-browser-core', mode: 'hide' }
];

function setAxisElementAvailability(element, available, mode = 'hide') {
    if (!element) return;

    const supportsDisabled = 'disabled' in element;

    if (available) {
        element.hidden = false;
        element.setAttribute('aria-hidden', 'false');
        if (supportsDisabled) {
            element.disabled = false;
            element.removeAttribute('aria-disabled');
        }
        element.classList.remove('disabled');
        return;
    }

    if (mode === 'disable' && supportsDisabled) {
        element.hidden = false;
        element.disabled = true;
        element.setAttribute('aria-disabled', 'true');
        element.classList.add('disabled');
        return;
    }

    element.hidden = true;
    element.setAttribute('aria-hidden', 'true');
    if (supportsDisabled) {
        element.disabled = true;
        element.setAttribute('aria-disabled', 'true');
    }
}

function hasAnyAxisCapability(capabilityIds = []) {
    return capabilityIds.some(capabilityId => window.isAxisCapabilityAvailable(capabilityId));
}

function updateSettingsSectionAvailability(manifest) {
    const categories = new Set((manifest.capabilities || []).map(capability => capability.category).filter(Boolean));
    const tabs = Array.from(document.querySelectorAll('.settings-tab'));
    const sections = Array.from(document.querySelectorAll('.settings-section'));

    tabs.forEach(tab => {
        const sectionName = tab.dataset.tab;
        const requiredCategories = window.SETTINGS_SECTION_RULES[sectionName] || [];
        const available = requiredCategories.length === 0 || requiredCategories.some(category => categories.has(category));
        tab.disabled = !available;
        tab.classList.toggle('disabled', !available);
        tab.setAttribute('aria-disabled', String(!available));
    });

    sections.forEach(section => {
        const sectionName = section.dataset.section;
        const requiredCategories = window.SETTINGS_SECTION_RULES[sectionName] || [];
        const available = requiredCategories.length === 0 || requiredCategories.some(category => categories.has(category));
        section.hidden = !available;
        section.classList.toggle('disabled', !available);
    });

    const activeTab = tabs.find(tab => tab.classList.contains('active') && !tab.disabled) || tabs.find(tab => !tab.disabled);
    if (activeTab) {
        tabs.forEach(tab => tab.classList.remove('active'));
        sections.forEach(section => section.classList.remove('active'));
        activeTab.classList.add('active');
        const activeSection = document.querySelector(`.settings-section[data-section="${activeTab.dataset.tab}"]`);
        if (activeSection) {
            activeSection.hidden = false;
            activeSection.classList.add('active');
        }
    }
}

function updateAxisSurfaceAvailability(manifest) {
    window.AXIS_SURFACE_RULES.forEach(({ selector, capability, anyOf, mode }) => {
        const element = document.querySelector(selector);
        const available = anyOf ? hasAnyAxisCapability(anyOf) : window.isAxisCapabilityAvailable(capability);
        setAxisElementAvailability(element, available, mode);
    });
}

window.hasAnyAxisCapability = hasAnyAxisCapability;
window.updateAxisSurfaceAvailability = updateAxisSurfaceAvailability;

// AXIS SHELL sidebar removed — the removed sidebar DOM's refresh fan-out
// (state badges, per-section surfaces, feeds) no longer has targets.
// Live consumers keep working:
//   refreshAxisSidebarConnectionState → no-op (perf + status surfaces are
//     updated directly by performance-monitor / chrome-bindings-c now)
//   refreshAxisSidebarFeeds → tab-manager create/close/activate fan-out,
//     kept as a stable extension point
window.refreshAxisSidebarConnectionState = function refreshAxisSidebarConnectionState() {};
window.refreshAxisSidebarFeeds = function refreshAxisSidebarFeeds() {};
window.updateSettingsSectionAvailability = updateSettingsSectionAvailability;
window.updateAxisSurfaceAvailability = updateAxisSurfaceAvailability;
