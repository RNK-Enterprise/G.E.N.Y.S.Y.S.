/**
 * Axis™ — RecentlyClosedManager unit tests
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
global.window = {};
global.CustomEvent = class CustomEvent {};

const { RecentlyClosedManager } = await import('../src/session/recently-closed-manager.js');

describe('RecentlyClosedManager', () => {
  beforeEach(() => store.clear());

  test('addClosedTab unshifts most-recent-first and persists', () => {
    const rcm = new RecentlyClosedManager();
    rcm.addClosedTab({ url: 'https://first.test', title: 'First' });
    rcm.addClosedTab({ url: 'https://second.test', title: 'Second' });
    const closed = rcm.getRecentlyClosed();
    expect(closed.map((t) => t.url)).toEqual(['https://second.test', 'https://first.test']);
    expect(closed[0].timestamp).toBeGreaterThan(0);
    expect(JSON.parse(store.get('rnk-axis-closed-tabs'))).toHaveLength(2);
  });

  test('caps the history at maxHistory (20)', () => {
    const rcm = new RecentlyClosedManager();
    for (let i = 0; i < 25; i += 1) rcm.addClosedTab({ url: `https://t${i}.test`, title: `T${i}` });
    const closed = rcm.getRecentlyClosed();
    expect(closed).toHaveLength(20);
    expect(closed[0].url).toBe('https://t24.test');
    expect(closed[19].url).toBe('https://t5.test');
  });

  test('clearHistory empties the list', () => {
    const rcm = new RecentlyClosedManager();
    rcm.addClosedTab({ url: 'https://a.test', title: 'A' });
    rcm.clearHistory();
    expect(rcm.getRecentlyClosed()).toEqual([]);
  });

  test('corrupt stored history falls back to empty', () => {
    store.set('rnk-axis-closed-tabs', '[broken');
    expect(new RecentlyClosedManager().getRecentlyClosed()).toEqual([]);
  });
});
