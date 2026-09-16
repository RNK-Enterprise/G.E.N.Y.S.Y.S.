/**
 * VEIL™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import { loadVEILManifest as loadVEILManifestFromCatalog } from '../engines/catalog-loader.js';
import './fallback-manifest.js';

console.log('VEIL v0.1.0 - Initializing...');

window.VEIL_MANIFEST_URL = './veil-manifest.json';
window.veilRuntime = {
    manifest: null,
    capabilities: new Map()
};

window.loadVEILManifest = async function loadVEILManifest() {
    // NOTE: window.veilRuntime may later hold the VEILEngineRuntime instance;
    // this loader works against whatever object currently sits there.
    const runtime = window.veilRuntime;
    const VEIL_MANIFEST_URL = window.VEIL_MANIFEST_URL;
    try {
        let manifest = await loadVEILManifestFromCatalog();
        if (!manifest?.capabilities?.length && !manifest?.engines?.length) {
            const response = await fetch(VEIL_MANIFEST_URL, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Manifest request failed: ${response.status}`);
            }
            manifest = await response.json();
        }

        runtime.manifest = manifest;
        runtime.capabilities = new Map((manifest.capabilities || []).map(capability => [capability.id, capability]));
        window.veilManifest = manifest;
        return manifest;
    } catch (error) {
        console.warn('VEIL manifest could not be loaded:', error);
        runtime.manifest = window.FALLBACK_VEIL_MANIFEST;
        runtime.capabilities = new Map();
        window.veilManifest = runtime.manifest;
        return runtime.manifest;
    }
};
