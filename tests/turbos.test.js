/**
 * VEIL™ — live turbo unit tests
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

const listeners = new Map();
function emit(type, event) {
  for (const fn of listeners.get(type) || []) fn(event);
}
global.window = {
  dispatchEvent: () => {},
  addEventListener: (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
  },
  removeEventListener: (type, fn) => {
    listeners.set(type, (listeners.get(type) || []).filter((f) => f !== fn));
  },
};
global.CustomEvent = class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };

const { tabSuspend } = await import('../src/turbos/tab-suspend.js');
const { dnsCache } = await import('../src/turbos/dns-cache.js');
const { navPrefetch } = await import('../src/turbos/nav-prefetch.js');

function makeTab(src, url) {
  const removed = [];
  const iframe = {
    src,
    srcdoc: null,
    removeAttribute(name) {
      removed.push(name);
      if (name === 'srcdoc') this.srcdoc = null;
    },
  };
  return { iframe, url, removed };
}

describe('turbo: tab-suspend', () => {
  test('suspend detaches a real URL; resume restores it', () => {
    const turbo = tabSuspend({});
    const tab = makeTab('https://example.test/page', 'https://example.test/page');
    turbo.suspendTab(tab);
    expect(tab.suspended).toBe(true);
    expect(tab._suspendedUrl).toBe('https://example.test/page');
    expect(tab.removed).toContain('srcdoc');
    expect(tab.iframe.src).toBe('about:blank');
    turbo.resumeTab(tab);
    expect(tab.suspended).toBe(false);
    expect(tab.iframe.src).toBe('https://example.test/page');
  });

  test('restores a retained srcdoc on resume', () => {
    const turbo = tabSuspend({});
    const tab = makeTab('about:blank', 'https://example.test/page');
    tab.iframe.srcdoc = '<html>veil</html>';
    turbo.suspendTab(tab);
    expect(tab._suspendedSrcdoc).toBe('<html>veil</html>');
    turbo.resumeTab(tab);
    expect(tab.iframe.srcdoc).toBe('<html>veil</html>');
    expect(tab.suspended).toBe(false);
  });

  test('skips veil:// URLs, about:blank, missing iframes, and double-suspends', () => {
    const turbo = tabSuspend({});
    const veil = makeTab('veil://newtab', 'veil://newtab');
    turbo.suspendTab(veil);
    expect(veil.suspended).toBeUndefined();

    const blank = makeTab('about:blank', 'about:blank');
    turbo.suspendTab(blank);
    expect(blank.suspended).toBeUndefined();

    const noIframe = { url: 'https://x.test' };
    turbo.suspendTab(noIframe);
    expect(noIframe.suspended).toBeUndefined();

    const tab = makeTab('https://y.test', 'https://y.test');
    turbo.suspendTab(tab);
    const snapshot = tab._suspendedUrl;
    turbo.suspendTab(tab);
    expect(tab._suspendedUrl).toBe(snapshot);
  });

  test('resume of a non-suspended tab is a no-op', () => {
    const turbo = tabSuspend({});
    const tab = makeTab('https://x.test', 'https://x.test');
    turbo.resumeTab(tab);
    expect(tab.suspended).toBeUndefined();
  });

  test('tab-deactivated suspends inactive tabs; tab-activated resumes', () => {
    const tabA = { ...makeTab('https://a.test', 'https://a.test'), id: 1 };
    const tabB = { ...makeTab('https://b.test', 'https://b.test'), id: 2 };
    const turbo = tabSuspend({ getTabs: () => [tabA, tabB] });
    turbo.start();

    emit('veil:tab-deactivated', { detail: { tab: tabA, activeId: 2 } });
    expect(tabA.suspended).toBe(true);
    expect(tabB.suspended).toBeUndefined();

    emit('veil:tab-activated', { detail: { tab: tabA } });
    expect(tabA.suspended).toBe(false);

    turbo.stop();
  });

  test('stop() resumes every suspended tab and detaches its listeners', () => {
    const tabA = makeTab('https://a.test', 'https://a.test');
    const turbo = tabSuspend({ getTabs: () => [tabA] });
    turbo.suspendTab(tabA);
    turbo.start();
    turbo.stop();
    expect(tabA.suspended).toBe(false);
    expect(tabA.iframe.src).toBe('https://a.test');
    expect(listeners.get('veil:tab-deactivated') || []).toHaveLength(0);
    expect(listeners.get('veil:tab-activated') || []).toHaveLength(0);
  });
});

describe('turbo: dns-cache', () => {
  test('lookup caches per host and reuses the entry without re-invoking', async () => {
    let calls = 0;
    global.window.__TAURI__ = {
      invoke: async (cmd, { host }) => {
        calls += 1;
        expect(cmd).toBe('turbo_dns_lookup');
        return { host, addrs: ['1.2.3.4'] };
      },
    };
    const turbo = dnsCache({});
    turbo.start();
    const { lookup } = global.window.veilDnsCache;
    const first = await lookup('a.test');
    const second = await lookup('a.test');
    expect(first).toMatchObject({ host: 'a.test', addrs: ['1.2.3.4'] });
    expect(second).toBe(first);
    expect(calls).toBe(1);
    turbo.stop();
    delete global.window.__TAURI__;
  });

  test('a failing lookup caches an error entry', async () => {
    global.window.__TAURI__ = { invoke: async () => { throw new Error('down'); } };
    const turbo = dnsCache({});
    turbo.start();
    const { lookup } = global.window.veilDnsCache;
    const result = await lookup('bad.test');
    expect(result).toMatchObject({ host: 'bad.test', error: true });
    expect(await lookup('bad.test')).toBe(result);
    turbo.stop();
    delete global.window.__TAURI__;
  });

  test('no Tauri bridge and empty host yield null', async () => {
    const turbo = dnsCache({});
    turbo.start();
    const { lookup } = global.window.veilDnsCache;
    expect(await lookup('never.test')).toBeNull();
    expect(await lookup('')).toBeNull();
    turbo.stop();
  });

  test('start publishes the cache surface; stop clears it and detaches', async () => {
    global.window.__TAURI__ = { invoke: async () => ({ host: 'a.test', addrs: [] }) };
    const turbo = dnsCache({});
    turbo.start();
    expect(global.window.veilDnsCache).toBeDefined();
    await global.window.veilDnsCache.lookup('a.test');
    expect(global.window.veilDnsCache.cache.size).toBe(1);
    turbo.stop();
    expect(global.window.veilDnsCache.cache.size).toBe(0);
    expect(listeners.get('veil:policy-allow') || []).toHaveLength(0);
    delete global.window.__TAURI__;
  });
});

describe('turbo: nav-prefetch', () => {
  function stubDocument() {
    const appended = [];
    global.document = {
      getElementById: () => null,
      createElement: () => ({}),
      head: { appendChild: (node) => appended.push(node) },
    };
    return appended;
  }

  test('prefetches http(s) URLs once, dedupes, and ignores other schemes', () => {
    const appended = stubDocument();
    const turbo = navPrefetch({});
    turbo.start();

    emit('veil:policy-allow', { detail: { url: 'https://a.test' } });
    emit('veil:policy-allow', { detail: { url: 'https://a.test' } });
    emit('veil:policy-allow', { detail: { url: 'ftp://b.test' } });
    emit('veil:policy-allow', { detail: {} });
    emit('veil:policy-allow', {});

    expect(appended).toHaveLength(1);
    expect(appended[0].href).toBe('https://a.test');
    expect(appended[0].rel).toBe('prefetch');
    turbo.stop();
  });

  test('caps the prefetch set above 40 entries', () => {
    const appended = stubDocument();
    const turbo = navPrefetch({});
    turbo.start();
    for (let i = 0; i < 45; i += 1) {
      emit('veil:policy-allow', { detail: { url: `https://t${i}.test` } });
    }
    expect(appended).toHaveLength(41);
    turbo.stop();
  });

  test('stop() detaches the policy-allow listener', () => {
    stubDocument();
    const turbo = navPrefetch({});
    turbo.start();
    expect(listeners.get('veil:policy-allow')).toHaveLength(1);
    turbo.stop();
    expect(listeners.get('veil:policy-allow') || []).toHaveLength(0);
  });
});
