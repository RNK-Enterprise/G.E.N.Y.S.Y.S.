/**
 * VEIL™ — HistoryManager unit tests
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
global.window = { dispatchEvent: () => {} };
global.CustomEvent = class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };

const { HistoryManager } = await import('../src/history-manager.js');

describe('HistoryManager', () => {
  let events;
  beforeEach(() => {
    store.clear();
    events = [];
    global.window.dispatchEvent = (e) => events.push(e.type);
  });

  test('starts empty, addEntry unshifts and persists', () => {
    const hm = new HistoryManager();
    expect(hm.getRecent()).toEqual([]);
    hm.addEntry('https://a.test', 'A');
    const recent = hm.getRecent();
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ url: 'https://a.test', title: 'A', visitCount: 1 });
    expect(events).toContain('history-updated');
    expect(JSON.parse(store.get('rnk-veil-history'))).toHaveLength(1);
  });

  test('title defaults to the URL when omitted', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://b.test');
    expect(hm.getRecent()[0].title).toBe('https://b.test');
  });

  test('revisiting the same URL bumps visitCount instead of adding an entry', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://a.test', 'Old Title');
    hm.addEntry('https://a.test', 'New Title');
    const entries = hm.getRecent();
    expect(entries).toHaveLength(1);
    expect(entries[0].visitCount).toBe(2);
    expect(entries[0].title).toBe('New Title');
  });

  test('removeEntry drops only the targeted id', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://a.test', 'A');
    hm.addEntry('https://b.test', 'B');
    const target = hm.getRecent().find((h) => h.url === 'https://a.test');
    hm.removeEntry(target.id);
    expect(hm.getRecent().map((h) => h.url)).toEqual(['https://b.test']);
  });

  test('clearHistory empties and emits history-cleared', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://a.test', 'A');
    hm.clearHistory();
    expect(hm.getRecent()).toEqual([]);
    expect(events).toContain('history-cleared');
  });

  test('search filters on title and URL, case-insensitive', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://rnk-enterprise.us', 'RNK Enterprise');
    expect(hm.search('ENTERPRISE')).toHaveLength(1);
    expect(hm.search('rnk-')).toHaveLength(1);
    expect(hm.search('nothing-matches')).toHaveLength(0);
  });

  test('getMostVisited sorts by visitCount descending', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://once.test', 'Once');
    hm.addEntry('https://often.test', 'Often');
    hm.addEntry('https://often.test', 'Often');
    hm.addEntry('https://often.test', 'Often');
    expect(hm.getMostVisited(2).map((h) => h.url)).toEqual(['https://often.test', 'https://once.test']);
  });

  test('getByDate filters to the requested day', () => {
    const hm = new HistoryManager();
    hm.addEntry('https://today.test', 'Today');
    const today = new Date().toISOString().slice(0, 10);
    expect(hm.getByDate(today)).toHaveLength(1);
    expect(hm.getByDate('2001-01-01')).toHaveLength(0);
  });

  test('trims history beyond maxEntries', () => {
    const hm = new HistoryManager();
    hm.maxEntries = 3;
    hm.addEntry('https://1.test', '1');
    hm.addEntry('https://2.test', '2');
    hm.addEntry('https://3.test', '3');
    hm.addEntry('https://4.test', '4');
    expect(hm.getRecent().map((h) => h.url)).toEqual(['https://4.test', 'https://3.test', 'https://2.test']);
  });

  test('survives corrupt stored history', () => {
    store.set('rnk-veil-history', 'not json');
    expect(new HistoryManager().getRecent()).toEqual([]);
  });
});
