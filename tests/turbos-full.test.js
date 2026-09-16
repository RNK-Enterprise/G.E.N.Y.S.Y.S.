/**
 * Axis™ — full turbo coverage: cache-budget, image-lazy-shell,
 * render-throttle, startup-defer, network-idle, memory-reclaim.
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

const { describe, expect, test, beforeEach, afterEach, jest } = await import('@jest/globals');

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

function classListStub() {
  const set = new Set();
  return {
    _set: set,
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

function docStub({ hidden = false } = {}) {
  const listeners = new Map();
  return {
    hidden,
    listeners,
    documentElement: { classList: classListStub() },
    addEventListener: (t, fn) => { listeners.set(t, [...(listeners.get(t) || []), fn]); },
    removeEventListener: (t, fn) => {
      listeners.set(t, (listeners.get(t) || []).filter((f) => f !== fn));
    },
  };
}

const dispatched = [];
const windowStub = {
  dispatchEvent: (e) => dispatched.push(e.type),
  addEventListener: () => {},
  removeEventListener: () => {},
};

beforeEach(() => {
  dispatched.length = 0;
  global.window = windowStub;
  global.localStorage = makeStorage();
  global.CustomEvent = class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };
});
afterEach(() => {
  jest.useRealTimers();
  delete global.requestIdleCallback;
});

const { cacheBudget } = await import('../src/turbos/cache-budget.js');
const { imageLazyShell } = await import('../src/turbos/image-lazy-shell.js');
const { renderThrottle } = await import('../src/turbos/render-throttle.js');
const { startupDefer } = await import('../src/turbos/startup-defer.js');
const { networkIdle } = await import('../src/turbos/network-idle.js');
const { memoryReclaim } = await import('../src/turbos/memory-reclaim.js');

describe('turbo: cache-budget', () => {
  test('start prunes immediately and records the budget from settings input', () => {
    global.document = { getElementById: () => ({ value: '250' }) };
    const turbo = cacheBudget();
    turbo.start();
    expect(global.localStorage.getItem('rnk-axis-cache-mb')).toBe('250');
    turbo.stop();
  });

  test('budget falls back to stored value, then 500; non-numeric input yields 500', () => {
    global.document = { getElementById: () => null };
    const turbo = cacheBudget();
    turbo.start();
    expect(global.localStorage.getItem('rnk-axis-cache-mb')).toBe('500');
    turbo.stop();

    global.localStorage.setItem('rnk-axis-cache-mb', '300');
    const t2 = cacheBudget();
    t2.start();
    expect(global.localStorage.getItem('rnk-axis-cache-mb')).toBe('300');
    t2.stop();

    global.localStorage.setItem('rnk-axis-cache-mb', 'abc');
    const t3 = cacheBudget();
    t3.start();
    expect(global.localStorage.getItem('rnk-axis-cache-mb')).toBe('500');
    t3.stop();
  });

  test('drops session/history-cache blobs when axis keys exceed 80', () => {
    global.document = { getElementById: () => null };
    for (let i = 0; i < 85; i += 1) global.localStorage.setItem(`rnk-axis-filler-${i}`, 'x');
    global.localStorage.setItem('rnk-axis-session-1', 'drop-me');
    global.localStorage.setItem('rnk-axis-history-cache-2', 'drop-me');
    global.localStorage.setItem('unrelated-key', 'keep-me');

    const turbo = cacheBudget();
    jest.useFakeTimers();
    turbo.start();
    expect(global.localStorage.getItem('rnk-axis-session-1')).toBeNull();
    expect(global.localStorage.getItem('rnk-axis-history-cache-2')).toBeNull();
    expect(global.localStorage.getItem('unrelated-key')).toBe('keep-me');
    turbo.stop();
  });

  test('stop clears the interval so prune stops running', () => {
    global.document = { getElementById: () => null };
    jest.useFakeTimers();
    const turbo = cacheBudget();
    turbo.start();
    turbo.stop();
    const setItemSpy = jest.spyOn(global.localStorage, 'setItem');
    jest.advanceTimersByTime(130000);
    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});

describe('turbo: image-lazy-shell', () => {
  test('without IntersectionObserver: dataset.src images are promoted directly', () => {
    const promoted = [];
    global.document = {
      querySelectorAll: () => [{ dataset: { src: 'https://img.test/a.png' }, set src(v) { promoted.push(v); this._src = v; }, get src() { return this._src; } }],
    };
    const turbo = imageLazyShell();
    turbo.start();
    expect(promoted).toEqual(['https://img.test/a.png']);
    turbo.stop();
  });

  test('with IntersectionObserver: observes images, promotes on intersect, stops observing', () => {
    const observed = [];
    const unobserved = [];
    let callback = null;
    class FakeObserver {
      constructor(cb) { callback = cb; }
      observe(img) { observed.push(img); }
      unobserve(img) { unobserved.push(img); }
      disconnect() { /* noop */ }
    }
    global.window = { ...windowStub, IntersectionObserver: FakeObserver };
    global.IntersectionObserver = FakeObserver;
    const img = { dataset: { src: 'https://img.test/b.png' }, src: 'https://img.test/b.png', closest: () => null };
    global.document = { querySelectorAll: () => [img] };

    const turbo = imageLazyShell();
    turbo.start();
    expect(observed).toEqual([img]);
    callback([{ target: img, isIntersecting: true }]);
    expect(img.src).toBe('https://img.test/b.png');
    expect(img.dataset.src).toBeUndefined();
    expect(unobserved).toEqual([img]);
    turbo.stop();
  });

  afterEach(() => { delete global.IntersectionObserver; });

  test('static images outside the titlebar get loading=lazy; titlebar images do not', () => {
    let callback = null;
    const ObserverClass = class { constructor(cb) { callback = cb; } observe() {} unobserve() {} disconnect() {} };
    global.window = { ...windowStub, IntersectionObserver: ObserverClass };
    global.IntersectionObserver = ObserverClass;
    const bodyImg = { dataset: {}, src: 'https://img.test/body.png', closest: () => null, loading: undefined };
    const barImg = { dataset: {}, src: 'https://img.test/bar.png', closest: (sel) => (sel === '#titlebar' ? {} : null), loading: undefined };
    global.document = { querySelectorAll: () => [bodyImg, barImg] };

    const turbo = imageLazyShell();
    turbo.start();
    expect(bodyImg.loading).toBe('lazy');
    expect(barImg.loading).toBeUndefined();
    callback([{ target: bodyImg, isIntersecting: false }]);
    expect(bodyImg.src).toBe('https://img.test/body.png');
    turbo.stop();
  });

  test('stop before start and double-stop are safe', () => {
    global.document = { querySelectorAll: () => [] };
    const turbo = imageLazyShell();
    turbo.stop();
    turbo.stop();
    expect(true).toBe(true);
  });
});

describe('turbo: render-throttle', () => {
  test('applies hidden state at start and toggles on visibilitychange', () => {
    const doc = docStub({ hidden: true });
    global.document = doc;
    const turbo = renderThrottle();
    turbo.start();
    expect(doc.documentElement.classList.contains('axis-render-throttled')).toBe(true);
    expect(dispatched).toContain('axis:render-throttle');

    doc.hidden = false;
    doc.listeners.get('visibilitychange')[0]();
    expect(doc.documentElement.classList.contains('axis-render-throttled')).toBe(false);
    turbo.stop();
    expect(doc.documentElement.classList.contains('axis-render-throttled')).toBe(false);
    expect(doc.listeners.get('visibilitychange') || []).toHaveLength(0);
  });
});

describe('turbo: startup-defer', () => {
  test('idle callback adds the ready class and fires the event', () => {
    let idleCb = null;
    global.window = { ...windowStub, requestIdleCallback: (cb) => { idleCb = cb; } };
    global.requestIdleCallback = global.window.requestIdleCallback;
    global.document = { documentElement: { classList: classListStub() } };
    const turbo = startupDefer();
    turbo.start();
    expect(typeof idleCb).toBe('function');
    idleCb();
    expect(global.document.documentElement.classList.contains('axis-startup-ready')).toBe(true);
    expect(dispatched).toContain('axis:startup-idle');
  });

  test('stop before the idle callback cancels the work', () => {
    let idleCb = null;
    global.window = { ...windowStub, requestIdleCallback: (cb) => { idleCb = cb; } };
    global.requestIdleCallback = global.window.requestIdleCallback;
    global.document = { documentElement: { classList: classListStub() } };
    const turbo = startupDefer();
    turbo.start();
    turbo.stop();
    idleCb();
    expect(global.document.documentElement.classList.contains('axis-startup-ready')).toBe(false);
    expect(dispatched).not.toContain('axis:startup-idle');
  });

  test('setTimeout fallback when requestIdleCallback is unavailable', () => {
    jest.useFakeTimers();
    delete global.requestIdleCallback;
    global.document = { documentElement: { classList: classListStub() } };
    const turbo = startupDefer();
    turbo.start();
    jest.advanceTimersByTime(1200);
    expect(global.document.documentElement.classList.contains('axis-startup-ready')).toBe(true);
    turbo.stop();
  });
});

describe('turbo: network-idle', () => {
  test('active first, idle after 15s of silence, active again on input', () => {
    jest.useFakeTimers();
    const doc = docStub();
    global.document = doc;
    const winListeners = new Map();
    global.window = {
      ...windowStub,
      addEventListener: (t, fn) => winListeners.set(t, [...(winListeners.get(t) || []), fn]),
      removeEventListener: (t, fn) => winListeners.set(t, (winListeners.get(t) || []).filter((f) => f !== fn)),
    };
    const turbo = networkIdle();
    turbo.start();
    expect(winListeners.get('mousemove')).toHaveLength(1);
    jest.advanceTimersByTime(15000);
    expect(doc.documentElement.classList.contains('axis-network-idle')).toBe(true);
    expect(dispatched).toContain('axis:network-idle');

    winListeners.get('keydown')[0]();
    expect(doc.documentElement.classList.contains('axis-network-idle')).toBe(false);
    turbo.stop();
    expect(winListeners.get('mousemove') || []).toHaveLength(0);
    expect(winListeners.get('scroll') || []).toHaveLength(0);
  });

  test('stop clears the pending idle timer', () => {
    jest.useFakeTimers();
    const doc = docStub();
    global.document = doc;
    global.window = { ...windowStub, addEventListener: () => {}, removeEventListener: () => {} };
    const turbo = networkIdle();
    turbo.start();
    turbo.stop();
    jest.advanceTimersByTime(20000);
    expect(doc.documentElement.classList.contains('axis-network-idle')).toBe(false);
  });
});

describe('turbo: memory-reclaim', () => {
  test('reclaim clears suspended-tab srcdoc, calls gc, and fires the event', () => {
    jest.useFakeTimers();
    let gcCalls = 0;
    global.window = { ...windowStub, gc: () => { gcCalls += 1; } };
    global.window.tabManager = {
      tabs: [
        { suspended: true, iframe: {}, _suspendedSrcdoc: '<html>blob</html>' },
        { suspended: false, iframe: {}, _suspendedSrcdoc: '<html>keep</html>' },
        { suspended: true },
      ],
    };
    const turbo = memoryReclaim();
    turbo.start();
    jest.advanceTimersByTime(30000);
    expect(global.window.tabManager.tabs[0]._suspendedSrcdoc).toBeNull();
    expect(global.window.tabManager.tabs[1]._suspendedSrcdoc).toBe('<html>keep</html>');
    expect(gcCalls).toBe(1);
    expect(dispatched).toContain('axis:memory-reclaim');
    turbo.stop();
  });

  test('double-start keeps a single interval; stop is idempotent', () => {
    jest.useFakeTimers();
    global.window = { ...windowStub };
    global.window.tabManager = { tabs: [] };
    const turbo = memoryReclaim();
    turbo.start();
    turbo.start();
    jest.advanceTimersByTime(30000);
    expect(dispatched.filter((t) => t === 'axis:memory-reclaim')).toHaveLength(1);
    turbo.stop();
    turbo.stop();
  });

  test('a throwing gc does not break the reclaim cycle', () => {
    jest.useFakeTimers();
    global.window = { ...windowStub, gc: () => { throw new Error('no gc'); } };
    global.window.tabManager = { tabs: [] };
    const turbo = memoryReclaim();
    turbo.start();
    expect(() => jest.advanceTimersByTime(30000)).not.toThrow();
    expect(dispatched).toContain('axis:memory-reclaim');
    turbo.stop();
  });
});
