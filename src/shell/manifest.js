/**
 * Axis™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import { loadAxisManifest as loadAxisManifestFromCatalog } from '../engines/catalog-loader.js';
import './fallback-manifest.js';

console.log('Axis v0.1.0 - Initializing...');

window.AXIS_MANIFEST_URL = './axis-manifest.json';
window.axisRuntime = {
    manifest: null,
    capabilities: new Map()
};

window.loadAxisManifest = async function loadAxisManifest() {
    // NOTE: window.axisRuntime may later hold the AxisEngineRuntime instance;
    // this loader works against whatever object currently sits there.
    const runtime = window.axisRuntime;
    const AXIS_MANIFEST_URL = window.AXIS_MANIFEST_URL;
    try {
        let manifest = await loadAxisManifestFromCatalog();
        if (!manifest?.capabilities?.length && !manifest?.engines?.length) {
            const response = await fetch(AXIS_MANIFEST_URL, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Manifest request failed: ${response.status}`);
            }
            manifest = await response.json();
        }

        runtime.manifest = manifest;
        runtime.capabilities = new Map((manifest.capabilities || []).map(capability => [capability.id, capability]));
        window.axisManifest = manifest;
        return manifest;
    } catch (error) {
        console.warn('Axis manifest could not be loaded:', error);
        runtime.manifest = window.FALLBACK_AXIS_MANIFEST;
        runtime.capabilities = new Map();
        window.axisManifest = runtime.manifest;
        return runtime.manifest;
    }
};
