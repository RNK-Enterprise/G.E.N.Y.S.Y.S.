/**
 * GENYSYS — product surfaces for the Operations, People, and Comms sections.
 * Copyright © 2026 Asgard Innovations / RNK. All Rights Reserved.
 *
 * Destinations are deliberately absent until their owning product contracts
 * provide authoritative routes. Rendering a clear, inert state prevents the
 * shell from inventing hosts, paths, or replacement product names.
 */

const SECTION_SURFACES = {
    operations: {
        product: 'A.R.C.H.',
        surface: 'Operations',
        detail: 'Operations surface',
    },
    people: {
        product: 'A.R.C.H.',
        surface: 'People',
        detail: 'Users database',
    },
    comms: {
        product: 'Comms platform',
        surface: 'Comms',
        detail: 'Replacement platform name not configured',
    },
};

export function mountRnkWebview(sectionId) {
    const mount = document.getElementById(`rnk-webview-${sectionId}`);
    if (!mount) return;
    const surface = SECTION_SURFACES[sectionId];
    if (!surface) return;

    mount.innerHTML = `
        <div class="rnk-webview-shell">
            <div class="rnk-webview-bar">
                <span class="rnk-webview-badge">${surface.product} — ${surface.surface}</span>
                <span class="rnk-webview-url">Destination not configured</span>
            </div>
            <div class="rnk-webview-host" id="rnk-webview-host-${sectionId}"></div>
            <div class="rnk-webview-note" id="rnk-webview-note-${sectionId}">
                ${surface.detail}. An authoritative destination is required before this surface can open.
            </div>
        </div>`;
}
