/**
 * GENYSYS™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

function getGENYSYSCapability(capabilityId) {
    return window.genysysRuntime.capabilities.get(capabilityId) || null;
}

window.isGENYSYSCapabilityAvailable = function isGENYSYSCapabilityAvailable(capabilityId) {
    const capability = getGENYSYSCapability(capabilityId);
    return Boolean(capability && capability.status !== 'experimental');
}

window.getGENYSYSCapability = getGENYSYSCapability;

function createGENYSYSChip(label, tone) {
    const chipTone = tone === undefined ? 'neutral' : tone;
    const chip = document.createElement('span');
    chip.className = `genysys-chip genysys-chip-${chipTone}`;
    chip.textContent = label;
    return chip;
}

function renderGENYSYSCapabilities(manifest) {
    const summary = document.getElementById('genysys-manifest-summary');
    const categoryList = document.getElementById('genysys-category-list');
    const surfaceList = document.getElementById('genysys-surface-list');
    const capabilityList = document.getElementById('genysys-capability-list');

    if (!summary || !categoryList || !surfaceList || !capabilityList) return;

    const capabilities = manifest.capabilities || [];
    const categories = [...new Set(capabilities.map(capability => capability.category).filter(Boolean))].sort();
    const surfaces = [...new Set([
        ...(manifest.surface_defaults || []),
        ...capabilities.map(capability => capability.surface).filter(Boolean)
    ])].sort();

    summary.textContent = `${capabilities.length} capabilities loaded from ${manifest.product || 'GENYSYS'} (${manifest.catalog_summary?.engines || 'unknown'} engines, ${manifest.catalog_summary?.turbos || 'unknown'} turbos)`;

    categoryList.innerHTML = '';
    categories.forEach(category => {
        categoryList.appendChild(createGENYSYSChip(category, 'category'));
    });

    surfaceList.innerHTML = '';
    surfaces.forEach(surface => {
        surfaceList.appendChild(createGENYSYSChip(surface, 'surface'));
    });

    capabilityList.innerHTML = '';
    const sortedCapabilities = [...capabilities].sort((a, b) => {
        const priorityOrder = { core: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
    });

    sortedCapabilities.forEach(capability => {
        const item = document.createElement('div');
        item.className = 'genysys-capability-item';
        item.innerHTML = `
            <div class="genysys-capability-meta">
                <strong>${capability.name}</strong>
                <span>${capability.id}</span>
            </div>
            <div class="genysys-capability-details">
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

// Single export block — createSidebarCapabilityCard was removed with the GENYSYS
// SHELL sidebar DOM (it was its only consumer).
window.getGENYSYSCapability = getGENYSYSCapability;
window.createGENYSYSChip = createGENYSYSChip;
window.renderGENYSYSCapabilities = renderGENYSYSCapabilities;
