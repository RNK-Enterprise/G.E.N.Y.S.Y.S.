/**
 * GENYSYS™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import { loadGENYSYSManifest as loadGENYSYSManifestFromCatalog } from '../engines/catalog-loader.js';
import './fallback-manifest.js';

console.log('GENYSYS v0.1.0 - Initializing...');

window.GENYSYS_MANIFEST_URL = './genysys-manifest.json';
window.genysysRuntime = {
    manifest: null,
    capabilities: new Map()
};

window.loadGENYSYSManifest = async function loadGENYSYSManifest() {
    // NOTE: window.genysysRuntime may later hold the GENYSYSEngineRuntime instance;
    // this loader works against whatever object currently sits there.
    const runtime = window.genysysRuntime;
    const GENYSYS_MANIFEST_URL = window.GENYSYS_MANIFEST_URL;
    try {
        let manifest = await loadGENYSYSManifestFromCatalog();
        if (!manifest?.capabilities?.length && !manifest?.engines?.length) {
            const response = await fetch(GENYSYS_MANIFEST_URL, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Manifest request failed: ${response.status}`);
            }
            manifest = await response.json();
        }

        runtime.manifest = manifest;
        runtime.capabilities = new Map((manifest.capabilities || []).map(capability => [capability.id, capability]));
        window.genysysManifest = manifest;
        return manifest;
    } catch (error) {
        console.warn('GENYSYS manifest could not be loaded:', error);
        runtime.manifest = window.FALLBACK_GENYSYS_MANIFEST;
        runtime.capabilities = new Map();
        window.genysysManifest = runtime.manifest;
        return runtime.manifest;
    }
};
