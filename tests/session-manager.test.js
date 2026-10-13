/**
 * GENYSYS™ — SessionManager unit tests
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

const { SessionManager } = await import('../src/session/session-manager.js');

describe('SessionManager', () => {
  beforeEach(() => store.clear());

  const tab = (url, title = url, pinned = false) => ({ url, title, favicon: null, pinned });

  test('saveSession persists a tab projection; loadSession reads it back', () => {
    const sm = new SessionManager();
    sm.saveSession('work', [tab('https://a.test', 'A', true), tab('https://b.test', 'B')]);
    const loaded = sm.loadSession('work');
    expect(loaded.tabs).toEqual([
      { url: 'https://a.test', title: 'A', favicon: null, pinned: true },
      { url: 'https://b.test', title: 'B', favicon: null, pinned: false },
    ]);
    expect(typeof loaded.timestamp).toBe('number');
  });

  test('loadSession on unknown name returns undefined', () => {
    expect(new SessionManager().loadSession('nope')).toBeUndefined();
  });

  test('listSessions reports names, tab counts, timestamps', () => {
    const sm = new SessionManager();
    sm.saveSession('one', [tab('https://a.test')]);
    sm.saveSession('two', [tab('https://a.test'), tab('https://b.test')]);
    const listed = sm.listSessions();
    expect(listed).toHaveLength(2);
    expect(listed.find((s) => s.name === 'two').tabCount).toBe(2);
  });

  test('deleteSession removes it; unknown delete is a no-op', () => {
    const sm = new SessionManager();
    sm.saveSession('gone', [tab('https://a.test')]);
    sm.deleteSession('gone');
    expect(sm.loadSession('gone')).toBeUndefined();
    sm.deleteSession('still-not-there');
    expect(sm.listSessions()).toHaveLength(0);
  });

  test('sessions persist across instances', () => {
    const sm = new SessionManager();
    sm.saveSession('durable', [tab('https://a.test')]);
    expect(new SessionManager().loadSession('durable')).toBeDefined();
  });

  test('corrupt stored sessions fall back to an empty object', () => {
    store.set('rnk-genysys-sessions', '{broken');
    expect(new SessionManager().listSessions()).toEqual([]);
  });
});
