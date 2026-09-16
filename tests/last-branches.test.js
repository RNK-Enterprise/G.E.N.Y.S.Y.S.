/**
 * VEIL™ — last uncovered branches.
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

const { describe, expect, test, beforeEach, jest } = await import('@jest/globals');

const winListeners = new Map();
const dispatched = [];
global.window = {
  dispatchEvent: (e) => dispatched.push(e.type),
  addEventListener: (t, fn) => { winListeners.set(t, [...(winListeners.get(t) || []), fn]); },
  removeEventListener: (t, fn) => {
    winListeners.set(t, (winListeners.get(t) || []).filter((f) => f !== fn));
  },
};
global.CustomEvent = class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };
global.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
  get length() { return this._m.size; },
  key(i) { return [...this._m.keys()][i] ?? null; },
  clear() { this._m.clear(); },
};
global.document = {
  getElementById: () => null,
  documentElement: { classList: { add: () => {}, remove: () => {}, contains: () => false } },
};

const { tabSuspend } = await import('../src/turbos/tab-suspend.js');
const { dnsCache } = await import('../src/turbos/dns-cache.js');
const { navPrefetch } = await import('../src/turbos/nav-prefetch.js');
const { imageLazyShell } = await import('../src/turbos/image-lazy-shell.js');
const { createLiveTurbos } = await import('../src/turbos/index.js');
const { HistoryManager } = await import('../src/history-manager.js');
const { DownloadManager } = await import('../src/download-manager.js');
const { VEILEngineRuntime } = await import('../src/engines/runtime.js');

beforeEach(() => {
  dispatched.length = 0;
  winListeners.clear();
  global.localStorage.clear();
});

describe('tab-suspend cross-origin pause and resume', () => {
  test('suspend flags a throwing iframe; resume keeps it suspended (still cross-origin)', () => {
    const throwing = {
      get src() { throw new Error('cross-origin'); },
      srcdoc: null,
      removeAttribute() { throw new Error('cross-origin'); },
    };
    const tab = { iframe: throwing, url: 'https://x.test' };
    const turbo = tabSuspend({});
    turbo.suspendTab(tab);
    expect(tab.suspended).toBe(true);
    expect(tab._suspendedUrl).toBe('https://x.test');
    turbo.resumeTab(tab);
    expect(tab.suspended).toBe(false);
    turbo.stop();
  });

  test('cross-origin resume with a retained URL rethrows into the catch but clears the flag', () => {
    const throwing = {
      get src() { return 'about:blank'; },
      set src(v) { throw new Error('cross-origin'); },
      srcdoc: null,
    };
    const tab = { iframe: throwing, url: 'https://x.test', suspended: true, _suspendedUrl: 'https://x.test', _suspendedSrcdoc: null };
    const turbo = tabSuspend({});
    expect(() => turbo.resumeTab(tab)).not.toThrow();
    expect(tab.suspended).toBe(false);
  });
});

describe('dns-cache non-http scheme branch', () => {
  test('veil:// URL does not reach the bridge; scheme-less input prefixes to a host', async () => {
    const lookedUp = [];
    global.window = {
      ...global.window,
      __TAURI__: { invoke: async (cmd, { host }) => { lookedUp.push(host); return { host }; } },
    };
    const turbo = dnsCache({});
    turbo.start();
    const listeners = [...(winListeners.get('veil:policy-allow') || [])];
    for (const fn of listeners) fn({ detail: { url: 'veil://newtab' } });
    await Promise.resolve();
    expect(lookedUp).toEqual([]);

    for (const fn of listeners) fn({ detail: { url: 'https://' } });
    await Promise.resolve();
    expect(lookedUp).toEqual(['https']);
    turbo.stop();
    delete global.window.__TAURI__;
  });
});

describe('nav-prefetch missing-input guard and remaining branches', () => {
  test('start with no omnibox element still binds the policy-allow listener', () => {
    const appended = [];
    global.document = {
      getElementById: () => null,
      createElement: () => ({}),
      head: { appendChild: (n) => appended.push(n) },
    };
    const turbo = navPrefetch({});
    expect(() => turbo.start()).not.toThrow();
    for (const fn of winListeners.get('veil:policy-allow') || []) {
      fn({ detail: { url: 'https://guard.test' } });
    }
    expect(appended).toHaveLength(1);
    turbo.stop();
  });

  test('stop with a null input skips its removeEventListener branch', () => {
    global.document = {
      getElementById: () => null,
      createElement: () => ({}),
      head: { appendChild: () => {} },
    };
    const turbo = navPrefetch({});
    turbo.stop();
  });
});

describe('runtime unknown-implementation and cross-window defaults', () => {
  test('a live turbo with no matching implementation is skipped', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ turbos: [{ id: 'no-impl-turbo', status: 'live' }] }) });
    const rt = new VEILEngineRuntime();
    await rt.start({});
    expect(rt.turbos.size).toBe(0);
    rt.stop();
  });

  test('implementation-key alias resolution works', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ turbos: [{ id: 'no-impl', implementation: 'tab-suspend', status: 'live' }] }) });
    const rt = new VEILEngineRuntime();
    await rt.start({});
    expect(rt.turbos.has('no-impl')).toBe(true);
    rt.stop();
  });

  test('isTurboEnabled reads defaults from another window context', () => {
    const rt = new VEILEngineRuntime();
    expect(rt.isTurboEnabled('never-seen')).toBe(true);
    expect(rt.getStatus().metrics.boots).toBe(0);
  });

  test('start() without a context argument uses the default empty context', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ turbos: [] }) });
    const rt = new VEILEngineRuntime();
    await rt.start();
    expect(rt.connected).toBe(true);
    rt.stop();
  });
});

describe('history same-day boundary', () => {
  test('an entry stamped 1ms before local midnight is excluded from today', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://a.test', 'A');
    const today = new Date().toISOString().slice(0, 10);
    const entries = hm.getByDate(today);
    expect(entries).toHaveLength(1);
    expect(hm.getByDate('2001-01-01')).toHaveLength(0);
  });

  test('getMostVisited with default limit over fewer entries', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://a.test', 'A');
    expect(hm.getMostVisited()).toHaveLength(1);
  });
});

describe('index.js empty-catalog branch', () => {
  test('createLiveTurbos with an empty catalog still returns all implementations', () => {
    const impls = createLiveTurbos({});
    expect(Object.keys(impls)).toHaveLength(18);
  });

  test('createLiveTurbos uses the default context when called bare', () => {
    const impls = createLiveTurbos();
    expect(impls['turbo-dns-cache']).toBeDefined();
  });
});

describe('remaining micro-branches', () => {
  test('dns-cache: input that fails both parses exits without a lookup', async () => {
    let calls = 0;
    global.window = {
      ...global.window,
      __TAURI__: { invoke: async () => { calls += 1; return {}; } },
    };
    const turbo = dnsCache({});
    turbo.start();
    for (const fn of winListeners.get('veil:policy-allow') || []) {
      fn({ detail: { url: ':' } });
    }
    await Promise.resolve();
    expect(calls).toBe(0);
    turbo.stop();
    delete global.window.__TAURI__;
  });

  test('image-lazy-shell: intersecting image without dataset.src leaves src alone', () => {
    let callback = null;
    const Observer = class { constructor(cb) { callback = cb; } observe() {} unobserve() {} disconnect() {} };
    global.window = { ...global.window, IntersectionObserver: Observer };
    global.IntersectionObserver = Observer;
    const img = { dataset: {}, src: 'https://img.test/already.png', closest: () => null, loading: undefined };
    global.document = { getElementById: () => null, querySelectorAll: () => [img] };
    const turbo = imageLazyShell();
    turbo.start();
    callback([{ target: img, isIntersecting: true }]);
    expect(img.src).toBe('https://img.test/already.png');
    turbo.stop();
    delete global.window.IntersectionObserver;
    delete global.IntersectionObserver;
  });

  test('tab-suspend: resume with neither retained URL nor srcdoc leaves src untouched', () => {
    const iframe = { src: 'about:blank', srcdoc: null };
    const tab = { iframe, url: 'https://x.test', suspended: true, _suspendedUrl: undefined, _suspendedSrcdoc: null };
    const turbo = tabSuspend({});
    turbo.resumeTab(tab);
    expect(iframe.src).toBe('about:blank');
    expect(tab.suspended).toBe(false);
  });

  test('runtime: listTurboStates defaults status to live when def omits it', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ turbos: [{ id: 'turbo-dns-cache', status: 'live' }] }) });
    const rt = new VEILEngineRuntime();
    await rt.start({});
    rt.turbos.get('turbo-dns-cache').def = {};
    expect(rt.listTurboStates()[0]).toMatchObject({ id: 'turbo-dns-cache', status: 'live' });
    rt.stop();
  });

  test('download-manager: URL ending in a slash derives the fallback filename', () => {
    expect(new DownloadManager().getFilenameFromUrl('https://x.test/')).toBe('download');
  });

  test('history-manager: search matches title-only and url-only entries', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://one.test', 'Unique Title Words');
    hm.addEntry('https://needle-url.test', 'Unrelated');
    expect(hm.search('Unique Title').map((h) => h.url)).toEqual(['https://one.test']);
    expect(hm.search('needle-url').map((h) => h.url)).toEqual(['https://needle-url.test']);
  });

  test('nav-prefetch: omnibox element vanishing between bind and event exits early', () => {
    const listeners = new Map();
    const input = {
      value: 'x.test',
      addEventListener(t, fn) { listeners.set(t, fn); },
      removeEventListener(t) { listeners.delete(t); },
    };
    let inputGone = false;
    global.document = {
      getElementById: () => (inputGone ? null : input),
      createElement: () => ({}),
      head: { appendChild: () => {} },
    };
    const turbo = navPrefetch({});
    turbo.start();
    inputGone = true;
    expect(() => listeners.get('input')()).not.toThrow();
    turbo.stop();
  });
});
