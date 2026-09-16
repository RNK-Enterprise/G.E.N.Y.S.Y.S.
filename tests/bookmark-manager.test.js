/**
 * Axis™ — BookmarkManager unit tests
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

const { BookmarkManager } = await import('../src/bookmark-manager.js');

describe('BookmarkManager', () => {
  let events;
  beforeEach(() => {
    store.clear();
    events = [];
    global.window.dispatchEvent = (e) => events.push(e.type);
  });

  test('ships with two default bookmarks (Google, GitHub)', () => {
    const bm = new BookmarkManager();
    expect(bm.getAllBookmarks()).toHaveLength(2);
    expect(bm.isBookmarked('https://www.google.com')).toBe(true);
    expect(bm.getBookmarksByFolder('dev').map((b) => b.title)).toEqual(['GitHub']);
  });

  test('addBookmark persists and emits bookmark-added', () => {
    const bm = new BookmarkManager();
    const added = bm.addBookmark('RNK', 'https://rnk-enterprise.us', 'work');
    expect(added.folder).toBe('work');
    expect(bm.isBookmarked('https://rnk-enterprise.us')).toBe(true);
    expect(events).toContain('bookmark-added');
    expect(JSON.parse(store.get('rnk-axis-bookmarks'))).toHaveLength(3);
  });

  test('addBookmark defaults the folder to favorites', () => {
    const bm = new BookmarkManager();
    expect(bm.addBookmark('X', 'https://x.test').folder).toBe('favorites');
  });

  test('removeBookmark removes, persists, emits; unknown id is a silent no-op', () => {
    const bm = new BookmarkManager();
    bm.removeBookmark(999);
    expect(events).not.toContain('bookmark-removed');
    bm.removeBookmark(1);
    expect(bm.isBookmarked('https://www.google.com')).toBe(false);
    expect(events).toContain('bookmark-removed');
  });

  test('getBookmark finds by exact URL and returns undefined otherwise', () => {
    const bm = new BookmarkManager();
    expect(bm.getBookmark('https://github.com')).toMatchObject({ title: 'GitHub' });
    expect(bm.getBookmark('https://missing.test')).toBeUndefined();
  });

  test('searchBookmarks matches title and URL case-insensitively', () => {
    const bm = new BookmarkManager();
    expect(bm.searchBookmarks('GIT')).toHaveLength(1);
    expect(bm.searchBookmarks('google.com')).toHaveLength(1);
    expect(bm.searchBookmarks('zzz')).toHaveLength(0);
  });

  test('survives corrupt stored bookmarks', () => {
    store.set('rnk-axis-bookmarks', '[broken');
    expect(new BookmarkManager().getAllBookmarks()).toHaveLength(2);
  });

  test('reads the legacy atlas key when the axis key is absent', () => {
    store.clear();
    store.set('rnk-atlas-bookmarks', JSON.stringify([{ id: 7, title: 'Legacy', url: 'https://legacy.test', folder: 'work' }]));
    const bm = new BookmarkManager();
    expect(bm.isBookmarked('https://legacy.test')).toBe(true);
    expect(bm.getBookmarksByFolder('work')).toHaveLength(1);
  });
});
