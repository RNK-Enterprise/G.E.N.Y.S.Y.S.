/**
 * Axis™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

function getAxisCapability(capabilityId) {
    return window.axisRuntime.capabilities.get(capabilityId) || null;
}

window.isAxisCapabilityAvailable = function isAxisCapabilityAvailable(capabilityId) {
    const capability = getAxisCapability(capabilityId);
    return Boolean(capability && capability.status !== 'experimental');
}

window.getAxisCapability = getAxisCapability;

function createAxisChip(label, tone = 'neutral') {
    const chip = document.createElement('span');
    chip.className = `axis-chip axis-chip-${tone}`;
    chip.textContent = label;
    return chip;
}

function renderAxisCapabilities(manifest) {
    const summary = document.getElementById('axis-manifest-summary');
    const categoryList = document.getElementById('axis-category-list');
    const surfaceList = document.getElementById('axis-surface-list');
    const capabilityList = document.getElementById('axis-capability-list');

    if (!summary || !categoryList || !surfaceList || !capabilityList) return;

    const capabilities = manifest.capabilities || [];
    const categories = [...new Set(capabilities.map(capability => capability.category).filter(Boolean))].sort();
    const surfaces = [...new Set([
        ...(manifest.surface_defaults || []),
        ...capabilities.map(capability => capability.surface).filter(Boolean)
    ])].sort();

    summary.textContent = `${capabilities.length} capabilities loaded from ${manifest.product || 'Axis'} (${manifest.catalog_summary?.engines || 'unknown'} engines, ${manifest.catalog_summary?.turbos || 'unknown'} turbos)`;

    categoryList.innerHTML = '';
    categories.forEach(category => {
        categoryList.appendChild(createAxisChip(category, 'category'));
    });

    surfaceList.innerHTML = '';
    surfaces.forEach(surface => {
        surfaceList.appendChild(createAxisChip(surface, 'surface'));
    });

    capabilityList.innerHTML = '';
    const sortedCapabilities = [...capabilities].sort((a, b) => {
        const priorityOrder = { core: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
    });

    sortedCapabilities.forEach(capability => {
        const item = document.createElement('div');
        item.className = 'axis-capability-item';
        item.innerHTML = `
            <div class="axis-capability-meta">
                <strong>${capability.name}</strong>
                <span>${capability.id}</span>
            </div>
            <div class="axis-capability-details">
                <span>${capability.category}</span>
                <span>${capability.surface}</span>
                <span>${capability.status}</span>
                <span>${capability.priority}</span>
            </div>
            <p>${capability.description || ''}</p>
        `;
        capabilityList.appendChild(item);
    });
}

// Single export block — createSidebarCapabilityCard was removed with the AXIS
// SHELL sidebar DOM (it was its only consumer).
window.getAxisCapability = getAxisCapability;
window.createAxisChip = createAxisChip;
window.renderAxisCapabilities = renderAxisCapabilities;
