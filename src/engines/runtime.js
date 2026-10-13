/**
 * GENYSYS Engine Runtime — local registry; replaces GENYSYS Bridge.
 */

import { loadGENYSYSManifest, listLiveTurbos, catalogSummary } from './catalog-loader.js';
import { createLiveTurbos } from '../turbos/index.js';

const STORAGE_KEY = 'rnk-genysys-turbo-enabled';

export class GENYSYSEngineRuntime {
  constructor() {
    this.connected = false;
    this.manifest = null;
    this.turbos = new Map();
    this.enabled = this._loadEnabled();
    this.metrics = { boots: 0, turboTicks: 0 };
  }

  _loadEnabled() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  _saveEnabled() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.enabled));
  }

  isTurboEnabled(id) {
    if (Object.prototype.hasOwnProperty.call(this.enabled, id)) {
      return this.enabled[id] !== false;
    }
    return true; // live turbos on by default
  }

  setTurboEnabled(id, on) {
    this.enabled[id] = Boolean(on);
    this._saveEnabled();
    const turbo = this.turbos.get(id);
    if (turbo) {
      if (on) turbo.start?.(this);
      else turbo.stop?.(this);
    }
    window.dispatchEvent(
      new CustomEvent('genysys:turbo-toggled', { detail: { id, enabled: on } }),
    );
  }

  async start(ctx = {}) {
    this.manifest = await loadGENYSYSManifest();
    const liveDefs = listLiveTurbos(this.manifest);
    const impls = createLiveTurbos(ctx);
    for (const def of liveDefs) {
      const impl = impls[def.id] || impls[def.implementation];
      if (!impl) continue;
      this.turbos.set(def.id, { def, ...impl });
      if (this.isTurboEnabled(def.id)) {
        impl.start?.(this);
      }
    }
    this.metrics.boots += 1;
    this.connected = true;
    this._setStatusIndicator(true);
    const summary = catalogSummary(this.manifest);
    window.dispatchEvent(
      new CustomEvent('genysys:runtime-ready', {
        detail: {
          engines: summary.engines,
          turbos: summary.turbos,
          live: this.turbos.size,
        },
      }),
    );
    return this.manifest;
  }

  stop() {
    for (const [, turbo] of this.turbos) {
      turbo.stop?.(this);
    }
    this.connected = false;
    this._setStatusIndicator(false);
  }

  _setStatusIndicator(connected) {
    const el = document.getElementById('genysys-status') || document.getElementById('genysys-status');
    if (!el) return;
    el.textContent = connected ? 'GENYSYS Runtime' : 'Runtime Off';
    el.style.color = connected ? 'var(--accent, #8ab4f8)' : 'var(--text-secondary)';
  }

  getStatus() {
    const summary = catalogSummary(this.manifest);
    return {
      connected: this.connected,
      engines: summary.engines,
      turbos: summary.turbos,
      liveEnabled: [...this.turbos.keys()].filter((id) => this.isTurboEnabled(id)).length,
      metrics: { ...this.metrics },
    };
  }

  listTurboStates() {
    return [...this.turbos.entries()].map(([id, t]) => ({
      id,
      name: t.def?.name || id,
      enabled: this.isTurboEnabled(id),
      status: t.def?.status || 'live',
    }));
  }
}

export const genysysRuntime = new GENYSYSEngineRuntime();
