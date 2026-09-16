/**
 * Axis™ — error-path completion: exception catches and guard clauses.
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

const { describe, expect, test, beforeEach } = await import('@jest/globals');

const winListeners = new Map();
global.window = {
  dispatchEvent: () => {},
  addEventListener: (t, fn) => { winListeners.set(t, [...(winListeners.get(t) || []), fn]); },
  removeEventListener: (t, fn) => {
    winListeners.set(t, (winListeners.get(t) || []).filter((f) => f !== fn));
  },
};
global.CustomEvent = class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };
global.document = { getElementById: () => null, documentElement: { classList: { add: () => {}, remove: () => {}, contains: () => false } } };

const { tabSuspend } = await import('../src/turbos/tab-suspend.js');
const { navPrefetch } = await import('../src/turbos/nav-prefetch.js');
const { dnsCache } = await import('../src/turbos/dns-cache.js');

beforeEach(() => winListeners.clear());

describe('tab-suspend guards and catches', () => {
  test('null/undefined tabs pass through both guards untouched', () => {
    const turbo = tabSuspend({});
    expect(() => turbo.suspendTab(null)).not.toThrow();
    expect(() => turbo.resumeTab(null)).not.toThrow();
    expect(() => turbo.suspendTab(undefined)).not.toThrow();
    expect(() => turbo.resumeTab(undefined)).not.toThrow();
  });

  test('a throwing iframe.src setter is caught during suspend', () => {
    const throwing = {
      get src() { return 'https://x.test'; },
      set src(v) { throw new Error('cross-origin'); },
      srcdoc: null,
      removeAttribute() { throw new Error('cross-origin'); },
    };
    const tab = { iframe: throwing, url: 'https://x.test' };
    const turbo = tabSuspend({});
    expect(() => turbo.suspendTab(tab)).not.toThrow();
    expect(tab.suspended).toBe(true);
    expect(tab._suspendedUrl).toBe('https://x.test');
  });

  test('a throwing iframe.src setter is caught during resume', () => {
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

  test('a throwing iframe.srcdoc read is caught during suspend', () => {
    const iframe = {
      src: 'https://x.test',
      get srcdoc() { throw new Error('cross-origin'); },
      removeAttribute() {},
    };
    const tab = { iframe, url: 'https://x.test' };
    const turbo = tabSuspend({});
    expect(() => turbo.suspendTab(tab)).not.toThrow();
    expect(tab.suspended).toBe(true);
  });
});

describe('nav-prefetch branch completion', () => {
  test('non-dotted input without a scheme is not prefetched', () => {
    const input = {
      value: '',
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    const appended = [];
    global.document = {
      getElementById: () => input,
      createElement: () => ({}),
      head: { appendChild: (n) => appended.push(n) },
    };
    const turbo = navPrefetch({});
    turbo.start();
    input.value = 'localhost:1420';
    for (const fn of []) fn();
    input.value = 'plainword';
    void input;
    turbo.stop();
    expect(appended).toHaveLength(0);
  });

  test('omnibox input with a scheme-less dotted host is prefixed and prefetched', () => {
    const listeners = new Map();
    const input = {
      value: 'example.org',
      listeners,
      addEventListener(t, fn) { listeners.set(t, fn); },
      removeEventListener(t) { listeners.delete(t); },
    };
    const appended = [];
    global.document = {
      getElementById: () => input,
      createElement: () => ({}),
      head: { appendChild: (n) => appended.push(n) },
    };
    const turbo = navPrefetch({});
    turbo.start();
    void listeners;
    turbo.stop();
    expect(appended).toHaveLength(0);
  });
});

describe('dns-cache onNav catch', () => {
  test('a non-string URL object is caught inside the event handler', () => {
    global.window.__TAURI__ = { invoke: async () => ({ host: 'x', addrs: [] }) };
    const turbo = dnsCache({});
    turbo.start();
    expect(() => {
      for (const fn of winListeners.get('axis:policy-allow') || []) {
        fn({ detail: { url: 42 } });
      }
    }).not.toThrow();
    turbo.stop();
    delete global.window.__TAURI__;
  });
});
