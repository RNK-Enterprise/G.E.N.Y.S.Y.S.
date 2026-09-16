/**
 * VEIL™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

function getVEILCapability(capabilityId) {
    return window.veilRuntime.capabilities.get(capabilityId) || null;
}

window.isVEILCapabilityAvailable = function isVEILCapabilityAvailable(capabilityId) {
    const capability = getVEILCapability(capabilityId);
    return Boolean(capability && capability.status !== 'experimental');
}

window.getVEILCapability = getVEILCapability;

function createVEILChip(label, tone = 'neutral') {
    const chip = document.createElement('span');
    chip.className = `veil-chip veil-chip-${tone}`;
    chip.textContent = label;
    return chip;
}

function renderVEILCapabilities(manifest) {
    const summary = document.getElementById('veil-manifest-summary');
    const categoryList = document.getElementById('veil-category-list');
    const surfaceList = document.getElementById('veil-surface-list');
    const capabilityList = document.getElementById('veil-capability-list');

    if (!summary || !categoryList || !surfaceList || !capabilityList) return;

    const capabilities = manifest.capabilities || [];
    const categories = [...new Set(capabilities.map(capability => capability.category).filter(Boolean))].sort();
    const surfaces = [...new Set([
        ...(manifest.surface_defaults || []),
        ...capabilities.map(capability => capability.surface).filter(Boolean)
    ])].sort();

    summary.textContent = `${capabilities.length} capabilities loaded from ${manifest.product || 'VEIL'} (${manifest.catalog_summary?.engines || 'unknown'} engines, ${manifest.catalog_summary?.turbos || 'unknown'} turbos)`;

    categoryList.innerHTML = '';
    categories.forEach(category => {
        categoryList.appendChild(createVEILChip(category, 'category'));
    });

    surfaceList.innerHTML = '';
    surfaces.forEach(surface => {
        surfaceList.appendChild(createVEILChip(surface, 'surface'));
    });

    capabilityList.innerHTML = '';
    const sortedCapabilities = [...capabilities].sort((a, b) => {
        const priorityOrder = { core: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
    });

    sortedCapabilities.forEach(capability => {
        const item = document.createElement('div');
        item.className = 'veil-capability-item';
        item.innerHTML = `
            <div class="veil-capability-meta">
                <strong>${capability.name}</strong>
                <span>${capability.id}</span>
            </div>
            <div class="veil-capability-details">
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

// Single export block — createSidebarCapabilityCard was removed with the VEIL
// SHELL sidebar DOM (it was its only consumer).
window.getVEILCapability = getVEILCapability;
window.createVEILChip = createVEILChip;
window.renderVEILCapabilities = renderVEILCapabilities;
