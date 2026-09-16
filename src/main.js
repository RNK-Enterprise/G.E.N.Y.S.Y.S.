/**
 * VEIL™ — thin orchestrator (standalone trusted client)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import {
  initLISABridge,
} from './lisa-bridge.js';
import { veilRuntime } from './engines/runtime.js';

// Boot order matters: managers → density/UI → sidebar/surfaces → tabs → bindings → init
import './shell/tauri-api.js';
import './shell/settings-panel-render.js';
import './shell/managers-boot.js';
import './shell/fallback-manifest.js';
import './shell/manifest.js';
import './ui/density-core.js';
import './ui/density-core-b.js';
import './ui/density-surfaces.js';
import './ui/density-surfaces-b.js';
import './shell/bind-helpers.js';
import './shell/capabilities.js';
import './shell/chrome-actions.js';
import './shell/spotlight-context.js';
import './shell/spotlight-suggestions.js';
import './shell/spotlight-suggestions-b.js';
import './shell/sidebar-utils.js';
import './shell/surfaces-core.js';
import './shell/sidebar-render.js';
import './shell/bookmarks-bar.js';
import './shell/section-nav.js';
import './browser/tab-manager.js';
import './browser/tab-manager-extras.js';
import './shell/chrome-bindings.js';
import './shell/chrome-bindings-b.js';
import './shell/chrome-bindings-c.js';

async function initializeApp() {
  if (window.__veilBooted) return; // boot re-entry guard — never double-restore tabs
  window.__veilBooted = true;
  const tabManager = window.tabManager;
  const engineRuntime = window.veilRuntime || veilRuntime;

  const manifest = await engineRuntime.start({ getTabs: () => tabManager?.tabs || [] });
  engineRuntime.manifest = manifest;
  engineRuntime.capabilities = new Map(
    (manifest.capabilities || []).map((capability) => [capability.id, capability]),
  );
  window.veilRuntime = engineRuntime;
  window.veilManifest = manifest;

  window.renderVEILCapabilities?.(manifest);
  window.renderBookmarksBar?.();
  window.updateSettingsSectionAvailability?.(manifest);
  window.updateVEILSurfaceAvailability?.(manifest);
  window.loadSettings?.();
  renderLiveTurboPanel();

  if (window.shellDensityState === 'compact' || window.shellDensityState === 'roomy') {
    window.setShellDensityState?.(window.shellDensityState);
  } else {
    window.applyTabBarCompactState?.();
    window.applyOmniboxCompactState?.();
    window.applySettingsDenseState?.();
    window.applyStatusbarMinimalState?.();
    window.applyTitlebarCompactState?.();
    window.applyDensityDependentSurfaces?.();
    window.syncShellDensityStateFromSurfaces?.();
  }

  window.applyVEILRuntimeStatus?.(true);

  const engineCount = manifest.catalog_summary?.engines || '0';
  const turboCount = manifest.catalog_summary?.turbos || '0';
  const liveCount = manifest.catalog_summary?.live_turbos || engineRuntime.turbos.size;
  window.updateStatusBar?.(
    `Ready - VEIL v0.1.0 | ${engineCount} engines · ${turboCount} turbos (${liveCount} live)`,
  );

  initLISABridge(tabManager);

  console.log('Restoring previous session...');
  if (!tabManager.restoreTabs()) {
    console.log('No saved session, creating initial tab...');
    tabManager.createTab('veil://newtab');
  }

  console.log('VEIL initialized successfully (standalone runtime)!');
}

function renderLiveTurboPanel() {
  const inventory = document.getElementById('perf-turbo-list');
  const summaryText = document.getElementById('perf-summary-text');
  const states = veilRuntime.listTurboStates();
  if (inventory) {
    inventory.innerHTML =
      states
        .map(
          (t) => `
            <label class="veil-turbo-row" style="display:flex;gap:0.5rem;align-items:center;margin:0.25rem 0;">
                <input type="checkbox" data-turbo-id="${t.id}" ${t.enabled ? 'checked' : ''}/>
                <span>${t.name}</span>
                <span class="perf-state-badge">${t.status}</span>
            </label>
        `,
        )
        .join('') +
      `<p class="perf-note">${veilRuntime.manifest?.catalog_summary?.turbos || 0} turbos in catalog · ${states.length} live</p>`;
    inventory.querySelectorAll('input[data-turbo-id]').forEach((input) => {
      input.addEventListener('change', () => {
        veilRuntime.setTurboEnabled(input.getAttribute('data-turbo-id'), input.checked);
      });
    });
  }
  if (summaryText) {
    summaryText.textContent = `VEIL runtime online with ${states.filter((s) => s.enabled).length} live turbos enabled.`;
  }
}

function startWhenAuthenticated() {
  const gate = document.getElementById('veil-auth-gate');
  const already =
    !gate ||
    gate.classList.contains('hidden') ||
    Boolean(window.__veilAuthenticated) ||
    Boolean(sessionStorage.getItem('rnk-veil-auth-session'));

  const boot = (detail = {}) => {
    // CI diagnostics: prove the full import graph executed and the orchestrator started.
    if (window.__TAURI__?.invoke) {
      window.__TAURI__.invoke('log_boot', { marker: 'main.js initializeApp' }).catch(() => {});
    }
    initializeApp().catch((err) => console.error('VEIL initializeApp failed:', err));
    import('./veil-welcome-tour.js').then((m) => m.initWelcomeSystem(detail || {}));
  };

  if (already) {
    boot(window.__veilAuthenticated || {});
    return;
  }

  document.addEventListener(
    'veil:authenticated',
    (e) => boot(e.detail || {}),
    { once: true },
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startWhenAuthenticated, { once: true });
} else {
  startWhenAuthenticated();
}
