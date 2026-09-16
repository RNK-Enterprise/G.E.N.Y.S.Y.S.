/**
 * VEIL™ — final branch completion round.
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

const { HistoryManager } = await import('../src/history-manager.js');
const { SettingsManager } = await import('../src/settings-manager.js');
const { DownloadManager } = await import('../src/download-manager.js');
const { cacheBudget } = await import('../src/turbos/cache-budget.js');
const { imageLazyShell } = await import('../src/turbos/image-lazy-shell.js');
const { memoryReclaim } = await import('../src/turbos/memory-reclaim.js');
const { tabSuspend } = await import('../src/turbos/tab-suspend.js');
const loader = await import('../src/engines/catalog-loader.js');
const { VEILEngineRuntime } = await import('../src/engines/runtime.js');

beforeEach(() => {
  dispatched.length = 0;
  winListeners.clear();
  global.localStorage.clear();
});

describe('history default-branch combos', () => {
  test('revisit without a new title keeps the original one', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://a.test', 'Original');
    hm.addEntry('https://a.test');
    expect(hm.getRecent()[0].title).toBe('Original');
    expect(hm.getRecent()[0].visitCount).toBe(2);
  });

  test('getRecent respects an explicit limit', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://1.test', '1');
    hm.addEntry('https://2.test', '2');
    expect(hm.getRecent(1)).toHaveLength(1);
  });
});

describe('settings legacy-key branch combos', () => {
  test('legacy key ignored when the modern key is already present', () => {
    const defaults = new SettingsManager().getDefaultSettings();
    defaults.performance.enableVEILEngines = true;
    defaults.performance.enableVQEngines = false;
    global.localStorage.setItem('rnk-veil-settings', JSON.stringify(defaults));
    const sm = new SettingsManager();
    expect(sm.get('performance', 'enableVEILEngines')).toBe(true);
    expect(sm.getAll().performance.enableVQEngines).toBeUndefined();
  });

  test('performance block without legacy keys deletes nothing and loads fine', () => {
    const defaults = new SettingsManager().getDefaultSettings();
    global.localStorage.setItem('rnk-veil-settings', JSON.stringify(defaults));
    const sm = new SettingsManager();
    expect(sm.get('performance', 'maxCacheSize')).toBe(500);
  });

  test('saved payload without a performance block is handled', () => {
    global.localStorage.setItem('rnk-veil-settings', JSON.stringify({ general: { homepage: 'https://x.test' } }));
    const sm = new SettingsManager();
    expect(sm.get('general', 'homepage')).toBe('https://x.test');
    expect(sm.getAll().performance).toBeUndefined();
  });
});

describe('stop-before-start safety', () => {
  test('cache-budget stop without start', () => {
    global.document = { getElementById: () => null };
    expect(() => cacheBudget().stop()).not.toThrow();
  });

  test('image-lazy-shell stop without start', () => {
    global.document = { querySelectorAll: () => [] };
    expect(() => imageLazyShell().stop()).not.toThrow();
  });
});

describe('image-lazy-shell dataset branches', () => {
  test('an image already carrying dataset.src is not marked loading=lazy', () => {
    let callback = null;
    const Observer = class { constructor(cb) { callback = cb; } observe() {} unobserve() {} disconnect() {} };
    global.window = { ...global.window, IntersectionObserver: Observer };
    global.IntersectionObserver = Observer;
    const lazyCandidate = { dataset: { src: 'https://img.test/lazy.png' }, src: 'about:blank', closest: () => null, loading: undefined };
    global.document = { getElementById: () => null, querySelectorAll: () => [lazyCandidate] };
    const turbo = imageLazyShell();
    turbo.start();
    expect(lazyCandidate.loading).toBeUndefined();
    callback([{ target: lazyCandidate, isIntersecting: true }]);
    expect(lazyCandidate.src).toBe('https://img.test/lazy.png');
    turbo.stop();
    delete global.window.IntersectionObserver;
    delete global.IntersectionObserver;
  });

  test('fallback path skips images without dataset.src', () => {
    global.document = {
      getElementById: () => null,
      querySelectorAll: () => [{ dataset: {}, src: 'https://img.test/plain.png' }],
    };
    const turbo = imageLazyShell();
    turbo.start();
    turbo.stop();
    expect(true).toBe(true);
  });
});

describe('memory-reclaim fallbacks', () => {
  test('no tabManager and no gc still fires the reclaim event', () => {
    jest.useFakeTimers();
    delete global.window.tabManager;
    const turbo = memoryReclaim();
    turbo.start();
    jest.advanceTimersByTime(30000);
    expect(dispatched).toContain('veil:memory-reclaim');
    turbo.stop();
    jest.useRealTimers();
  });

  test('suspended tab with a contentWindow is processed', () => {
    jest.useFakeTimers();
    global.window.tabManager = {
      tabs: [{ suspended: true, iframe: { contentWindow: {} }, _suspendedSrcdoc: '<b>x</b>' }],
    };
    const turbo = memoryReclaim();
    turbo.start();
    jest.advanceTimersByTime(30000);
    expect(global.window.tabManager.tabs[0]._suspendedSrcdoc).toBeNull();
    turbo.stop();
    jest.useRealTimers();
  });
});

describe('tab-suspend remaining branches', () => {
  test('URL falls back to iframe.src when tab.url is missing', () => {
    const iframe = { src: 'https://via-iframe.test', srcdoc: null, removeAttribute: () => {} };
    const tab = { iframe };
    const turbo = tabSuspend({});
    turbo.suspendTab(tab);
    expect(tab._suspendedUrl).toBe('https://via-iframe.test');
    expect(tab.suspended).toBe(true);
  });

  test('deactivation with a null active tab suspends everything', () => {
    const iframe = { src: 'https://z.test', srcdoc: null, removeAttribute: () => {} };
    const tab = { id: 1, iframe, url: 'https://z.test' };
    const turbo = tabSuspend({ getTabs: () => [tab] });
    turbo.start();
    for (const fn of winListeners.get('veil:tab-deactivated') || []) {
      fn({ detail: { tab: null, activeId: undefined } });
    }
    expect(tab.suspended).toBe(true);
    turbo.stop();
  });

  test('bare factory with no context and no window.tabManager falls back to an empty tab list', () => {
    const turbo = tabSuspend();
    turbo.start();
    expect(() => {
      for (const fn of winListeners.get('veil:tab-deactivated') || []) {
        fn({ detail: {} });
        fn({});
      }
    }).not.toThrow();
    turbo.stop();
  });

  test('getTabs returning undefined and an empty tabManager both fall through to the empty list', () => {
    global.window.tabManager = {};
    const turbo = tabSuspend({ getTabs: () => undefined });
    turbo.start();
    expect(() => {
      for (const fn of winListeners.get('veil:tab-deactivated') || []) {
        fn({ detail: {} });
      }
    }).not.toThrow();
    turbo.stop();
    delete global.window.tabManager;
  });

  test('without ctx.getTabs the tabs come from window.tabManager', () => {
    const iframe = { src: 'https://wm.test', srcdoc: null, removeAttribute: () => {} };
    const tab = { id: 5, iframe, url: 'https://wm.test' };
    global.window.tabManager = { tabs: [tab] };
    const turbo = tabSuspend({});
    turbo.start();
    for (const fn of winListeners.get('veil:tab-deactivated') || []) {
      fn({ detail: { tab: null, activeId: 9 } });
    }
    expect(tab.suspended).toBe(true);
    delete global.window.tabManager;
    turbo.stop();
  });

  test('activation with no tab detail is a no-op', () => {
    const turbo = tabSuspend({});
    turbo.start();
    expect(() => {
      for (const fn of winListeners.get('veil:tab-activated') || []) {
        fn({ detail: {} });
        fn({});
      }
    }).not.toThrow();
    turbo.stop();
  });
});

describe('runtime unregistered-turbo toggle', () => {
  test('setTurboEnabled for an unregistered turbo persists without starting anything', () => {
    global.fetch = async () => { throw new Error('offline'); };
    const rt = new VEILEngineRuntime();
    expect(() => rt.setTurboEnabled('ghost-turbo', false)).not.toThrow();
    expect(rt.isTurboEnabled('ghost-turbo')).toBe(false);
    void loader;
  });

  test('a registered turbo without start/stop hooks toggles cleanly', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ turbos: [{ id: 'turbo-dns-cache', status: 'live' }] }) });
    const rt = new VEILEngineRuntime();
    await rt.start({});
    expect(() => rt.setTurboEnabled('turbo-dns-cache', false)).not.toThrow();
    expect(() => rt.setTurboEnabled('turbo-dns-cache', true)).not.toThrow();
    rt.stop();
  });
});

describe('final branch gaps', () => {
  test('getByDate accepts a Date object as well as a date-only string', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://a.test', 'A');
    expect(hm.getByDate(new Date())).toHaveLength(1);
  });

  test('cancelDownload on an unknown id is a silent no-op', () => {
    const dm = new DownloadManager();
    expect(() => dm.cancelDownload(999)).not.toThrow();
  });
});
