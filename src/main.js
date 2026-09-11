/**
 * Axis™ — thin orchestrator (standalone trusted client)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import {
  initLISABridge,
} from './lisa-bridge.js';
import { axisRuntime } from './engines/runtime.js';

// Boot order matters: managers → density/UI → sidebar/surfaces → tabs → bindings → init
import './shell/tauri-api.js';
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
  if (window.__axisBooted) return; // boot re-entry guard — never double-restore tabs
  window.__axisBooted = true;
  const tabManager = window.tabManager;
  const engineRuntime = window.axisRuntime || axisRuntime;

  const manifest = await engineRuntime.start({ getTabs: () => tabManager?.tabs || [] });
  engineRuntime.manifest = manifest;
  engineRuntime.capabilities = new Map(
    (manifest.capabilities || []).map((capability) => [capability.id, capability]),
  );
  window.axisRuntime = engineRuntime;
  window.axisManifest = manifest;

  window.renderAxisCapabilities?.(manifest);
  window.renderBookmarksBar?.();
  window.updateSettingsSectionAvailability?.(manifest);
  window.updateAxisSurfaceAvailability?.(manifest);
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

  window.applyAxisRuntimeStatus?.(true);

  const engineCount = manifest.catalog_summary?.engines || '0';
  const turboCount = manifest.catalog_summary?.turbos || '0';
  const liveCount = manifest.catalog_summary?.live_turbos || engineRuntime.turbos.size;
  window.updateStatusBar?.(
    `Ready - Axis v0.1.0 | ${engineCount} engines · ${turboCount} turbos (${liveCount} live)`,
  );

  initLISABridge(tabManager);

  console.log('Restoring previous session...');
  if (!tabManager.restoreTabs()) {
    console.log('No saved session, creating initial tab...');
    tabManager.createTab('axis://newtab');
  }

  console.log('Axis initialized successfully (standalone runtime)!');
}

function renderLiveTurboPanel() {
  const inventory = document.getElementById('perf-turbo-list');
  const summaryText = document.getElementById('perf-summary-text');
  const states = axisRuntime.listTurboStates();
  if (inventory) {
    inventory.innerHTML =
      states
        .map(
          (t) => `
            <label class="axis-turbo-row" style="display:flex;gap:0.5rem;align-items:center;margin:0.25rem 0;">
                <input type="checkbox" data-turbo-id="${t.id}" ${t.enabled ? 'checked' : ''}/>
                <span>${t.name}</span>
                <span class="perf-state-badge">${t.status}</span>
            </label>
        `,
        )
        .join('') +
      `<p class="perf-note">${axisRuntime.manifest?.catalog_summary?.turbos || 0} turbos in catalog · ${states.length} live</p>`;
    inventory.querySelectorAll('input[data-turbo-id]').forEach((input) => {
      input.addEventListener('change', () => {
        axisRuntime.setTurboEnabled(input.getAttribute('data-turbo-id'), input.checked);
      });
    });
  }
  if (summaryText) {
    summaryText.textContent = `Axis runtime online with ${states.filter((s) => s.enabled).length} live turbos enabled.`;
  }
}

function startWhenAuthenticated() {
  const gate = document.getElementById('axis-auth-gate');
  const already =
    !gate ||
    gate.classList.contains('hidden') ||
    Boolean(window.__axisAuthenticated) ||
    Boolean(sessionStorage.getItem('rnk-axis-auth-session'));

  const boot = (detail = {}) => {
    initializeApp().catch((err) => console.error('Axis initializeApp failed:', err));
    import('./axis-welcome-tour.js').then((m) => m.initWelcomeSystem(detail || {}));
  };

  if (already) {
    boot(window.__axisAuthenticated || {});
    return;
  }

  document.addEventListener(
    'axis:authenticated',
    (e) => boot(e.detail || {}),
    { once: true },
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startWhenAuthenticated, { once: true });
} else {
  startWhenAuthenticated();
}
