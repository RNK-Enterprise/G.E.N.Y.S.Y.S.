/**
 * GENYSYS™ — main.js split recipes (module manifest).
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * The AST engine (parse, external-rewrite, module builder) lives in
 * split-main-engine.mjs; this file holds only the line-slice recipes.
 */

import {
  ROOT,
  lines,
  slice,
  HEADER,
  SHARED,
  listTopLevelDecls,
  rewriteExternals,
  buildModule,
  writeFile,
} from './split-main-engine.mjs';

// ---------- fallback manifest ----------
writeFile(
  'src/shell/fallback-manifest.js',
  `${HEADER}
window.FALLBACK_ATLAS_MANIFEST = ${slice(258, 509)};
`,
);

// ---------- sessions ----------
writeFile(
  'src/session/session-manager.js',
  `${HEADER}
${slice(35, 83)}

window.SessionManager = SessionManager;
export { SessionManager };
export default SessionManager;
`,
);

writeFile(
  'src/session/recently-closed-manager.js',
  `${HEADER}
${slice(88, 132)}

window.RecentlyClosedManager = RecentlyClosedManager;
export { RecentlyClosedManager };
export default RecentlyClosedManager;
`,
);

// ---------- tauri api ----------
writeFile(
  'src/shell/tauri-api.js',
  `${HEADER}
window.appWindow = null;
window.invoke = null;

window.initTauriAPI = async function initTauriAPI() {
    try {
        const windowModule = await import('@tauri-apps/api/window');
        const tauriModule = await import('@tauri-apps/api/tauri');
        window.appWindow = windowModule.appWindow;
        window.invoke = tauriModule.invoke;
        console.log('Tauri API loaded successfully');
        return true;
    } catch (error) {
        console.error('Tauri API not available:', error);
        window.appWindow = {
            minimize: () => console.log('Minimize'),
            maximize: () => console.log('Maximize'),
            unmaximize: () => console.log('Unmaximize'),
            close: () => window.close(),
            isMaximized: async () => false
        };
        window.invoke = (cmd, args) => {
            console.log('Invoke:', cmd, args);
            return Promise.resolve({ success: true });
        };
        return false;
    }
};
`,
);

// Collect all function names from main into SHARED before building modules
{
  const allFns = listTopLevelDecls(lines.join('\n'));
  for (const n of allFns) SHARED.add(n);
}

// density core: state + early helpers + density apply through applySettingsDensityControls
buildModule(
  'src/ui/density-core.js',
  HEADER,
  [
    slice(1596, 1617),
    slice(1619, 1677),
    slice(163, 228),
    slice(1679, 2052),
  ].join('\n\n'),
);

buildModule(
  'src/ui/density-surfaces.js',
  HEADER,
  [slice(2054, 2230), slice(2333, 2547), slice(4229, 4288)].join('\n\n'),
);

buildModule('src/shell/bind-helpers.js', HEADER, slice(2232, 2331));

writeFile(
  'src/shell/manifest.js',
  `${HEADER}
import { loadGENYSYSManifest as loadGENYSYSManifestFromCatalog } from '../engines/catalog-loader.js';
import './fallback-manifest.js';

console.log('GENYSYS v0.1.0 - Initializing...');

window.ATLAS_MANIFEST_URL = './genysys-manifest.json';
window.atlasRuntime = {
    manifest: null,
    capabilities: new Map()
};

window.loadAtlasManifest = async function loadAtlasManifest() {
    const atlasRuntime = window.atlasRuntime;
    const ATLAS_MANIFEST_URL = window.ATLAS_MANIFEST_URL;
    try {
        let manifest = await loadGENYSYSManifestFromCatalog();
        if (!manifest?.capabilities?.length && !manifest?.engines?.length) {
            const response = await fetch(ATLAS_MANIFEST_URL, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(\`Manifest request failed: \${response.status}\`);
            }
            manifest = await response.json();
        }

        atlasRuntime.manifest = manifest;
        atlasRuntime.capabilities = new Map((manifest.capabilities || []).map(capability => [capability.id, capability]));
        window.atlasRuntime = atlasRuntime;
        window.genysysManifest = manifest;
        window.atlasManifest = manifest;
        return manifest;
    } catch (error) {
        console.warn('GENYSYS manifest could not be loaded:', error);
        atlasRuntime.manifest = window.FALLBACK_ATLAS_MANIFEST;
        atlasRuntime.capabilities = new Map();
        window.atlasRuntime = atlasRuntime;
        window.atlasManifest = atlasRuntime.manifest;
        return atlasRuntime.manifest;
    }
};
`,
);

buildModule('src/shell/capabilities.js', HEADER, slice(518, 641));
buildModule('src/shell/chrome-actions.js', HEADER, slice(642, 771));
buildModule('src/shell/spotlight-context.js', HEADER, slice(773, 918));
buildModule('src/shell/spotlight-suggestions.js', HEADER, slice(920, 1538));
buildModule('src/shell/sidebar-utils.js', HEADER, slice(1540, 1594));
buildModule('src/shell/capability-activity.js', HEADER, slice(2549, 2704));
buildModule('src/shell/sidebar-sections.js', HEADER, slice(2706, 2853));
buildModule('src/shell/surfaces-core.js', HEADER, slice(2855, 3073));
buildModule('src/shell/sidebar-pins.js', HEADER, slice(3075, 3431));
buildModule('src/shell/sidebar-feeds.js', HEADER, slice(3433, 3607));
buildModule('src/shell/surfaces-extra.js', HEADER, slice(3609, 4147));
buildModule('src/shell/bookmarks-bar.js', HEADER, slice(4149, 4227));
buildModule('src/shell/command-palette.js', HEADER, slice(4290, 4541));
buildModule('src/shell/sidebar-render.js', HEADER, slice(4543, 4991));

writeFile(
  'src/shell/managers-boot.js',
  `${HEADER}
import DownloadManager from '../download-manager.js';
import BookmarkManager from '../bookmark-manager.js';
import SettingsManager from '../settings-manager.js';
import HistoryManager from '../history-manager.js';
import SessionManager from '../session/session-manager.js';
import RecentlyClosedManager from '../session/recently-closed-manager.js';

window.downloadManager = new DownloadManager();
window.bookmarkManager = new BookmarkManager();
window.settingsManager = new SettingsManager();
window.historyManager = new HistoryManager();
window.sessionManager = new SessionManager();
window.recentlyClosedManager = new RecentlyClosedManager();
`,
);

buildModule(
  'src/shell/section-nav.js',
  `${HEADER}
import { mountServerControl, unmountServerControl } from '../genysys-server-control.js';
`,
  slice(5028, 5063) + '\n' + slice(5006, 5022),
);

// Tab manager — rewrite external refs; keep class export
{
  const raw = slice(5068, 5596);
  const locals = listTopLevelDecls(raw);
  SHARED.add('TabManager');
  let body = rewriteExternals(raw, locals);
  // helpers used inside class that are external already rewritten
  writeFile(
    'src/browser/tab-manager.js',
    `${HEADER}
import { normalizeUrl, navigateWithLISA } from '../lisa-bridge.js';

${body}

window.TabManager = TabManager;
export { TabManager };
export default TabManager;
`,
  );
}

// Chrome bindings — large; may need split after
buildModule(
  'src/shell/chrome-bindings.js',
  `${HEADER}
import ToastManager from '../ui/toast.js';
import LoadingManager from '../ui/loading.js';
import PerformanceMonitor from '../perf/performance-monitor.js';
import { genysysRuntime } from '../engines/runtime.js';
import TabManager from '../browser/tab-manager.js';
`,
  [
    `window.tabManager = new TabManager();
window.toastManager = new ToastManager();
window.loadingManager = new LoadingManager();
window.tabManager.toast = window.toastManager;
const tabManager = window.tabManager;
const toastManager = window.toastManager;
const loadingManager = window.loadingManager;
`,
    slice(5606, 6073),
    slice(6075, 6291),
    slice(6293, 6460),
    slice(6462, 6571),
    `window.atlasBridge = genysysRuntime;
window.genysysRuntime = genysysRuntime;
const atlasBridge = genysysRuntime;
`,
    slice(6580, 6599),
    `window.perfMonitor = new PerformanceMonitor();
`,
  ].join('\n'),
);

fs.writeFileSync(path.join(ROOT, 'scripts/.split-shared-names.json'), JSON.stringify([...SHARED].sort(), null, 2));
console.log('done');
