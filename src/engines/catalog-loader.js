/**
 * Axis catalog loader — engines + turbos from local manifest.
 */

const MANIFEST_URLS = ['./axis-manifest.json', './axis-manifest.json'];

let _manifest = null;

export function getManifest() {
  return _manifest;
}

export async function loadAxisManifest() {
  for (const url of MANIFEST_URLS) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) continue;
      _manifest = await response.json();
      return _manifest;
    } catch {
      /* try next */
    }
  }
  _manifest = {
    manifest_version: '2.0',
    product: 'Axis',
    catalog_summary: { engines: '0', turbos: '0', mode: 'fallback', source: 'Axis' },
    capabilities: [],
    engines: [],
    turbos: [],
  };
  return _manifest;
}

export function listLiveTurbos(manifest = _manifest) {
  return (manifest?.turbos || []).filter((t) => t.status === 'live');
}

export function listEngines(manifest = _manifest) {
  return manifest?.engines || [];
}

export function catalogSummary(manifest = _manifest) {
  return manifest?.catalog_summary || { engines: '0', turbos: '0' };
}
