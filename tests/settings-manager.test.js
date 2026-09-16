/**
 * VEIL™ — SettingsManager unit tests
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

const { SettingsManager } = await import('../src/settings-manager.js');

describe('SettingsManager', () => {
  test('defaults: homepage, search engine, theme, engines enabled', () => {
    const s = new SettingsManager();
    expect(s.get('general', 'homepage')).toBe('veil://newtab');
    expect(s.get('general', 'searchEngine')).toBe('duckduckgo');
    expect(s.get('appearance', 'theme')).toBe('dark-neutral');
    expect(s.get('performance', 'enableVEILEngines')).toBe(true);
    expect(s.get('privacy', 'savePasswords')).toBe(false);
  });

  test('set persists through localStorage and get reads it back', () => {
    const s = new SettingsManager();
    s.set('general', 'homepage', 'veil://start');
    expect(s.get('general', 'homepage')).toBe('veil://start');
    const reloaded = new SettingsManager();
    expect(reloaded.get('general', 'homepage')).toBe('veil://start');
  });

  test('set on unknown category is a no-op', () => {
    const s = new SettingsManager();
    s.set('nope', 'key', 1);
    expect(s.getAll().nope).toBeUndefined();
  });

  test('getAll returns the live settings object', () => {
    const s = new SettingsManager();
    expect(s.getAll()).toBe(s.settings);
  });

  test('export/import round-trips; invalid JSON import returns false', () => {
    const s = new SettingsManager();
    s.set('appearance', 'fontSize', 'large');
    const exported = s.exportSettings();
    const t = new SettingsManager();
    expect(t.importSettings(exported)).toBe(true);
    expect(t.get('appearance', 'fontSize')).toBe('large');
    expect(t.importSettings('{not json')).toBe(false);
  });

  test('import merges over defaults instead of replacing them', () => {
    const s = new SettingsManager();
    s.importSettings('{"appearance":{"theme":"light"}}');
    expect(s.get('appearance', 'theme')).toBe('light');
    expect(s.get('appearance', 'fontSize')).toBe('medium');
    expect(s.get('general', 'homepage')).toBe('veil://newtab');
  });

  test('reset restores defaults and persists them', () => {
    const s = new SettingsManager();
    s.set('general', 'homepage', 'https://changed.example');
    s.reset();
    expect(s.get('general', 'homepage')).toBe('veil://newtab');
    expect(JSON.parse(store.get('rnk-veil-settings')).general.homepage).toBe('veil://newtab');
  });

  test('migrates the legacy obfuscated performance key', () => {
    const legacy = new SettingsManager().getDefaultSettings();
    legacy.performance = { ...legacy.performance, enable: false };
    delete legacy.performance.enableVEILEngines;
    const legacyKey = ['enable', 'V', 'Q', 'Engines'].join('');
    legacy.performance[legacyKey] = false;
    store.set('rnk-veil-settings', JSON.stringify(legacy));

    const s = new SettingsManager();
    expect(s.get('performance', 'enableVEILEngines')).toBe(false);
    expect(s.getAll().performance[legacyKey]).toBeUndefined();
  });

  test('corrupt saved JSON falls back to defaults', () => {
    store.set('rnk-veil-settings', '{broken');
    const s = new SettingsManager();
    expect(s.get('general', 'homepage')).toBe('veil://newtab');
  });

  test('falls back to the atlas settings key when veil key is absent', () => {
    store.clear();
    const atlas = new SettingsManager().getDefaultSettings();
    atlas.general.homepage = 'https://atlas.example';
    store.set('rnk-atlas-settings', JSON.stringify(atlas));
    expect(new SettingsManager().get('general', 'homepage')).toBe('https://atlas.example');
  });
});
