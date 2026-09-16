/**
 * VEIL™ — branch-completion tests: event paths, storage failures,
 * wrong-state transitions, and catalog success flows.
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

const { describe, expect, test, beforeEach, afterEach, jest } = await import('@jest/globals');

function makeStorage(initial = {}, { failSet = false } = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { if (failSet) throw new Error('quota exceeded'); map.set(k, String(v)); },
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

function classListStub() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
    toggle(c, force) {
      const on = force === undefined ? !set.has(c) : Boolean(force);
      if (on) set.add(c); else set.delete(c);
      return on;
    },
  };
}

const dispatched = [];
const errors = [];
let winListeners = new Map();
let documentStub = { getElementById: () => null, documentElement: { classList: classListStub() } };

function baseWindow(extra = {}) {
  return {
    dispatchEvent: (e) => dispatched.push(e.type),
    addEventListener: (t, fn) => { winListeners.set(t, [...(winListeners.get(t) || []), fn]); },
    removeEventListener: (t, fn) => {
      winListeners.set(t, (winListeners.get(t) || []).filter((f) => f !== fn));
    },
    __TAURI__: undefined,
    ...extra,
  };
}

beforeEach(() => {
  dispatched.length = 0;
  errors.length = 0;
  winListeners = new Map();
  global.window = baseWindow();
  global.localStorage = makeStorage();
  global.CustomEvent = class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };
  global.document = documentStub;
  jest.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')));
  jest.spyOn(console, 'warn').mockImplementation((...a) => errors.push(a.join(' ')));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const { BookmarkManager } = await import('../src/bookmark-manager.js');
const { HistoryManager } = await import('../src/history-manager.js');
const { SettingsManager } = await import('../src/settings-manager.js');
const { DownloadManager } = await import('../src/download-manager.js');
const { dnsCache } = await import('../src/turbos/dns-cache.js');
const { navPrefetch } = await import('../src/turbos/nav-prefetch.js');
const { tabSuspend } = await import('../src/turbos/tab-suspend.js');
const { renderThrottle } = await import('../src/turbos/render-throttle.js');
const { startupDefer } = await import('../src/turbos/startup-defer.js');
const loader = await import('../src/engines/catalog-loader.js');
const { VEILEngineRuntime } = await import('../src/engines/runtime.js');

describe('storage-failure paths (quota exceeded)', () => {
  test('BookmarkManager.saveBookmarks survives a throwing localStorage', () => {
    global.localStorage = makeStorage({}, { failSet: true });
    const bm = new BookmarkManager();
    expect(() => bm.addBookmark('X', 'https://x.test')).not.toThrow();
    expect(errors.some((e) => e.includes('bookmarks'))).toBe(true);
  });

  test('HistoryManager.saveHistory survives a throwing localStorage', () => {
    global.localStorage = makeStorage({}, { failSet: true });
    const hm = new HistoryManager();
    expect(() => hm.addEntry('https://a.test', 'A')).not.toThrow();
    expect(errors.some((e) => e.includes('history'))).toBe(true);
  });

  test('SettingsManager.saveSettings survives a throwing localStorage', () => {
    global.localStorage = makeStorage({}, { failSet: true });
    const sm = new SettingsManager();
    expect(() => sm.set('general', 'homepage', 'https://x.test')).not.toThrow();
    expect(errors.some((e) => e.includes('settings'))).toBe(true);
  });
});

describe('wrong-state download transitions', () => {
  test('resume/cancel on non-paused/non-existent ids are safe no-ops', () => {
    jest.useFakeTimers();
    const dm = new DownloadManager();
    dm.resumeDownload(999);
    const d = dm.startDownload('https://x.test/f.bin');
    jest.advanceTimersByTime(20000);
    expect(d.status).toBe('completed');
    dm.resumeDownload(d.id);
    expect(d.status).toBe('completed');
    jest.useRealTimers();
  });

  test('cancel while paused stays failed', () => {
    const dm = new DownloadManager();
    const d = dm.startDownload('https://x.test/f.bin');
    dm.pauseDownload(d.id);
    dm.cancelDownload(d.id);
    expect(d.status).toBe('failed');
    expect(dispatched).toContain('download-cancelled');
  });
});

describe('dns-cache event path', () => {
  test('veil:policy-allow triggers a hostname lookup through the cache', async () => {
    const lookedUp = [];
    global.window = baseWindow({
      __TAURI__: {
        invoke: async (cmd, { host }) => {
          expect(cmd).toBe('turbo_dns_lookup');
          lookedUp.push(host);
          return { host, addrs: ['9.9.9.9'] };
        },
      },
    });
    const turbo = dnsCache({});
    turbo.start();
    for (const fn of winListeners.get('veil:policy-allow') || []) {
      fn({ detail: { url: 'https://event.test/path' } });
    }
    await Promise.resolve();
    await Promise.resolve();
    expect(lookedUp).toEqual(['event.test']);
    expect(global.window.veilDnsCache.cache.get('event.test')).toMatchObject({ host: 'event.test' });
    turbo.stop();
  });

  test('malformed and missing URLs are ignored without throwing', () => {
    global.window = baseWindow();
    const turbo = dnsCache({});
    turbo.start();
    expect(() => {
      for (const fn of winListeners.get('veil:policy-allow') || []) {
        fn({ detail: { url: 42 } });
        fn({ detail: {} });
        fn({});
      }
    }).not.toThrow();
    turbo.stop();
  });

  test('lookup on empty host returns null before touching the bridge', async () => {
    global.window = baseWindow();
    const turbo = dnsCache({});
    turbo.start();
    expect(await global.window.veilDnsCache.lookup('')).toBeNull();
    turbo.stop();
  });
});

describe('nav-prefetch omnibox path', () => {
  function inputStub() {
    const listeners = new Map();
    return {
      listeners,
      value: '',
      addEventListener: (t, fn) => { listeners.set(t, [...(listeners.get(t) || []), fn]); },
      removeEventListener: (t, fn) => {
        listeners.set(t, (listeners.get(t) || []).filter((f) => f !== fn));
      },
    };
  }

  test('omnibox input prefetches the typed host once, scheme-less included', () => {
    jest.useFakeTimers();
    const appended = [];
    const input = inputStub();
    global.document = {
      ...documentStub,
      getElementById: (id) => (id === 'url-input' ? input : null),
      createElement: () => ({}),
      head: { appendChild: (n) => appended.push(n) },
    };
    const turbo = navPrefetch({});
    turbo.start();
    input.value = 'example.com';
    input.listeners.get('input')[0]();
    jest.advanceTimersByTime(400);
    expect(appended).toHaveLength(1);
    expect(appended[0].href).toBe('https://example.com');

    input.value = 'https://direct.test/page';
    input.listeners.get('input')[0]();
    jest.advanceTimersByTime(400);
    expect(appended).toHaveLength(2);
    expect(appended[1].href).toBe('https://direct.test/page');

    input.value = '   ';
    input.listeners.get('input')[0]();
    jest.advanceTimersByTime(400);
    expect(appended).toHaveLength(2);
    turbo.stop();
  });

  test('clearing the timer stops a pending prefetch', () => {
    jest.useFakeTimers();
    const appended = [];
    const input = inputStub();
    global.document = {
      ...documentStub,
      getElementById: (id) => (id === 'omnibox' ? input : null),
      createElement: () => ({}),
      head: { appendChild: (n) => appended.push(n) },
    };
    const turbo = navPrefetch({});
    turbo.start();
    input.value = 'pending.test';
    input.listeners.get('input')[0]();
    turbo.stop();
    jest.advanceTimersByTime(400);
    expect(appended).toHaveLength(0);
  });

  test('missing omnibox element start/stop is safe', () => {
    global.document = { ...documentStub, getElementById: () => null };
    const turbo = navPrefetch({});
    expect(() => { turbo.start(); turbo.stop(); }).not.toThrow();
  });
});

describe('tab-suspend remaining paths', () => {
  test('suspend skips a tab with an empty URL', () => {
    const iframe = { src: '', srcdoc: null, removeAttribute: () => {} };
    const turbo = tabSuspend({});
    turbo.suspendTab({ iframe, url: '' });
    expect(iframe.src).toBe('');
  });

  test('resume restores plain URL when no srcdoc was retained', () => {
    const iframe = { src: 'about:blank', srcdoc: null, removeAttribute: () => {} };
    const turbo = tabSuspend({});
    const tab = { iframe, url: 'https://plain.test', suspended: true, _suspendedUrl: 'https://plain.test', _suspendedSrcdoc: null };
    turbo.resumeTab(tab);
    expect(iframe.src).toBe('https://plain.test');
    expect(tab.suspended).toBe(false);
  });

  test('deactivation resumes the active tab even while suspending others', () => {
    const mk = (id) => {
      const iframe = { src: `https://t${id}.test`, srcdoc: null, removeAttribute: function rm(n) { if (n === 'srcdoc') this.srcdoc = null; } };
      return { id, iframe, url: `https://t${id}.test` };
    };
    const active = mk(1);
    const other = mk(2);
    const turbo = tabSuspend({ getTabs: () => [active, other] });
    turbo.start();
    for (const fn of winListeners.get('veil:tab-deactivated') || []) {
      fn({ detail: { tab: active, activeId: 1 } });
    }
    expect(active.suspended).toBeUndefined();
    expect(other.suspended).toBe(true);
    turbo.stop();
    expect(other.suspended).toBe(false);
  });
});

describe('render-throttle branch completion', () => {
  test('stop without a prior start is a safe no-op', () => {
    global.document = { ...documentStub, addEventListener: () => {}, removeEventListener: () => {} };
    const turbo = renderThrottle();
    expect(() => turbo.stop()).not.toThrow();
  });
});

describe('startup-defer cancelled before scheduling', () => {
  test('start after stop still schedules (cancelled reset)', () => {
    let idleCb = null;
    global.window = { ...baseWindow(), requestIdleCallback: (cb) => { idleCb = cb; } };
    global.requestIdleCallback = global.window.requestIdleCallback;
    global.document = { documentElement: { classList: classListStub() } };
    const turbo = startupDefer();
    turbo.start();
    turbo.stop();
    turbo.start();
    idleCb();
    expect(global.document.documentElement.classList.contains('veil-startup-ready')).toBe(true);
  });
});

describe('catalog-loader success path and cached reads', () => {
  test('a successful fetch populates the manifest and cached accessors read it', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        manifest_version: '2.0',
        catalog_summary: { engines: '3', turbos: '9', mode: 'local', source: 'VEIL' },
        capabilities: [{ id: 'cap' }],
        engines: [{ id: 'e1' }],
        turbos: [{ id: 't1', status: 'live' }],
      }),
    });
    const manifest = await loader.loadVEILManifest();
    expect(manifest.capabilities).toHaveLength(1);
    expect(loader.getManifest()).toBe(manifest);
    expect(loader.listEngines()).toEqual([{ id: 'e1' }]);
    expect(loader.listLiveTurbos()).toEqual([{ id: 't1', status: 'live' }]);
    expect(loader.catalogSummary()).toMatchObject({ engines: '3' });
  });

  test('a non-ok response falls through to the fallback manifest', async () => {
    global.fetch = async () => ({ ok: false, status: 404 });
    const manifest = await loader.loadVEILManifest();
    expect(manifest.product).toBe('VEIL');
    expect(manifest.capabilities).toEqual([]);
  });
});

describe('runtime remaining branches', () => {
  test('corrupt enabled-JSON falls back to an empty preference map', async () => {
    global.localStorage = makeStorage({ 'rnk-veil-turbo-enabled': '{broken' });
    global.fetch = async () => { throw new Error('offline'); };
    const rt = new VEILEngineRuntime();
    expect(rt.isTurboEnabled('anything')).toBe(true);
    await rt.start({});
    rt.stop();
  });

  test('status indicator writes to the veil-status element when present', async () => {
    const el = { textContent: '', style: {} };
    global.document = { ...documentStub, getElementById: (id) => (id === 'veil-status' ? el : null) };
    global.fetch = async () => { throw new Error('offline'); };
    const rt = new VEILEngineRuntime();
    await rt.start({});
    expect(el.textContent).toBe('VEIL Runtime');
    rt.stop();
    expect(el.textContent).toBe('Runtime Off');
  });
});
