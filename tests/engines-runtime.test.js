/**
 * GENYSYS™ — engine runtime + catalog loader unit tests
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

global.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};
global.CustomEvent = class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };
global.document = { getElementById: () => null };
global.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.has(k) ? this._store.get(k) : null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const loader = await import('../src/engines/catalog-loader.js');
const { describe, expect, test, afterEach, jest } = await import('@jest/globals');
const { GENYSYSEngineRuntime } = await import('../src/engines/runtime.js');
const { createLiveTurbos } = await import('../src/turbos/index.js');

describe('catalog-loader', () => {
  test('getManifest starts null; fallback manifest is well-formed', async () => {
    expect(loader.getManifest()).toBeNull();
    global.fetch = async () => { throw new Error('offline'); };
    const manifest = await loader.loadGENYSYSManifest();
    expect(manifest.manifest_version).toBe('2.0');
    expect(manifest.product).toBe('GENYSYS');
    expect(manifest.capabilities).toEqual([]);
    expect(loader.getManifest()).toBe(manifest);
  });

  test('listLiveTurbos / listEngines / catalogSummary tolerate empty manifests', () => {
    expect(loader.listLiveTurbos({ turbos: [{ id: 'x', status: 'live' }, { id: 'y', status: 'stub' }] })).toEqual([{ id: 'x', status: 'live' }]);
    expect(loader.listLiveTurbos({})).toEqual([]);
    expect(loader.listEngines({})).toEqual([]);
    expect(loader.catalogSummary({})).toEqual({ engines: '0', turbos: '0' });
  });
});

describe('GENYSYSEngineRuntime', () => {
  afterEach(() => localStorage.clear());

  test('createLiveTurbos registers every implementation (both key styles)', () => {
    const impls = createLiveTurbos({});
    expect(impls['turbo-tab-suspend']).toBeDefined();
    expect(impls['tab-suspend']).toBeDefined();
    expect(Object.keys(impls).filter((k) => k.startsWith('turbo-'))).toHaveLength(9);
  });

  test('start() with an empty manifest stays connected with no turbos', async () => {
    global.fetch = async () => { throw new Error('offline'); };
    const rt = new GENYSYSEngineRuntime();
    const manifest = await rt.start({});
    expect(rt.connected).toBe(true);
    expect(rt.turbos.size).toBe(0);
    expect(rt.metrics.boots).toBe(1);
    expect(manifest.manifest_version).toBe('2.0');
    expect(rt.getStatus()).toMatchObject({ connected: true, liveEnabled: 0 });
  });

  test('registers live turbos from the manifest and starts enabled ones', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        manifest_version: '2.0',
        product: 'GENYSYS',
        catalog_summary: { engines: '1', turbos: '2', mode: 'local', source: 'GENYSYS' },
        capabilities: [],
        engines: [{ id: 'engine-a', name: 'A' }],
        turbos: [
          { id: 'turbo-tab-suspend', status: 'live', name: 'Tab Suspend' },
          { id: 'turbo-memory-reclaim', status: 'live', name: 'Memory Reclaim' },
        ],
      }),
    });
    const rt = new GENYSYSEngineRuntime();
    await rt.start({});
    expect(rt.turbos.size).toBe(2);
    expect(rt.getStatus().liveEnabled).toBe(2);
    const states = rt.listTurboStates();
    expect(states).toHaveLength(2);
    expect(states[0]).toMatchObject({ id: 'turbo-tab-suspend', enabled: true, status: 'live' });
    rt.stop();
  });

  test('isTurboEnabled defaults to true; setTurboEnabled persists and toggles start/stop', async () => {
    const rt = new GENYSYSEngineRuntime();
    expect(rt.isTurboEnabled('anything')).toBe(true);
    rt.turbos.set('t1', { def: { id: 't1' }, start: jest.fn(), stop: jest.fn() });
    rt.setTurboEnabled('t1', false);
    expect(rt.isTurboEnabled('t1')).toBe(false);
    expect(JSON.parse(localStorage.getItem('rnk-genysys-turbo-enabled')).t1).toBe(false);
    rt.setTurboEnabled('t1', true);
    expect(rt.turbos.get('t1').stop).toHaveBeenCalled();
    expect(rt.turbos.get('t1').start).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('rnk-genysys-turbo-enabled')).t1).toBe(true);
  });

  test('stop() disconnects and halts turbos', async () => {
    global.fetch = async () => { throw new Error('offline'); };
    const rt = new GENYSYSEngineRuntime();
    await rt.start({});
    const started = { def: { id: 't1' }, start: jest.fn(), stop: jest.fn() };
    rt.turbos.set('t1', started);
    rt.stop();
    expect(rt.connected).toBe(false);
    expect(started.stop).toHaveBeenCalled();
  });

  test('explicitly disabled turbos register but are not counted enabled', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ turbos: [{ id: 'turbo-tab-suspend', status: 'live' }] }),
    });
    const rt = new GENYSYSEngineRuntime();
    rt.setTurboEnabled('turbo-tab-suspend', false);
    await rt.start({});
    expect(rt.turbos.size).toBe(1);
    expect(rt.getStatus().liveEnabled).toBe(0);
    expect(rt.listTurboStates()[0]).toMatchObject({ id: 'turbo-tab-suspend', enabled: false });
  });
});
