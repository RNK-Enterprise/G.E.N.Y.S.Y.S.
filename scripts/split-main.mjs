/**
 * Split src/main.js into ≤500 LOC modules.
 * Local decls stay lexical; external SHARED refs → window.X; locals assigned onto window.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as acorn from 'acorn';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAIN = path.join(ROOT, 'src/main.js');
const lines = fs.readFileSync(MAIN, 'utf8').split(/\n/);
const slice = (a, b) => lines.slice(a - 1, b).join('\n');

const HEADER = `/**
 * Axis™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */
`;

/** Names that may be referenced across modules (managers, state, helpers). */
const SHARED = new Set([
  'appWindow', 'invoke', 'initTauriAPI',
  'atlasRuntime', 'ATLAS_MANIFEST_URL', 'FALLBACK_ATLAS_MANIFEST', 'loadAtlasManifest',
  'atlasSidebarLastQuery', 'atlasSidebarLastSelectedIndex', 'atlasSidebarSelectionByQuery',
  'atlasSidebarPins', 'tabBarDensityState', 'omniboxDensityState', 'settingsPanelDensityState',
  'statusbarDensityState', 'titlebarDensityState', 'shellDensityState', 'shortcutsDensityState',
  'toastDensityState', 'performancePanelDensityState', 'searchProviderDensityState',
  'bookmarksBarDensityState', 'atlasSidebarDensityState', 'sessionsDensityState',
  'modalDensityState', 'loadingDensityState', 'atlasSidebarFeedSignals',
  'atlasSidebarSectionCollapseState', 'atlasSidebarCapabilitiesCollapsed',
  'atlasSidebarActivitySignals', 'settingsSectionCollapseState',
  'SETTINGS_SECTION_COLLAPSIBLE', 'settingsDensityControlConfigs',
  'ATLAS_SIDEBAR_COLLAPSIBLE_SECTIONS', 'SETTINGS_SECTION_RULES', 'ATLAS_SURFACE_RULES',
  'downloadManager', 'bookmarkManager', 'settingsManager', 'historyManager',
  'sessionManager', 'recentlyClosedManager', 'activeSection',
  'tabManager', 'toastManager', 'loadingManager', 'atlasBridge', 'perfMonitor',
  'tabSearch', 'omnibox', 'backBtn', 'forwardBtn', 'refreshBtn', 'homeBtn',
  'suggestionsDropdown', 'currentSearchProvider', 'searchProviders',
  'selectedSuggestionIndex', 'bookmarkBtn', 'ATLAS_HEALTH_URL',
  'frameCount', 'lastTime', 'lisaAssistantMounted', 'adminOpsMounted',
  'SessionManager', 'RecentlyClosedManager', 'TabManager',
  'axisRuntime', 'normalizeUrl', 'navigateWithLISA', 'initLISABridge', 'initMessageListener',
  'mountServerControl', 'unmountServerControl',
]);

function listTopLevelDecls(code) {
  const names = new Set();
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true });
  } catch {
    return names;
  }
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id) names.add(node.id.name);
    if (node.type === 'ClassDeclaration' && node.id) names.add(node.id.name);
    if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) {
        if (d.id?.type === 'Identifier') names.add(d.id.name);
      }
    }
    if (
      node.type === 'ExpressionStatement' &&
      node.expression?.type === 'AssignmentExpression' &&
      node.expression.left?.type === 'MemberExpression' &&
      node.expression.left.object?.name === 'window' &&
      node.expression.left.property?.type === 'Identifier'
    ) {
      names.add(node.expression.left.property.name);
    }
  }
  return names;
}

function rewriteExternals(code, localDefs) {
  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ranges: true,
      allowAwaitOutsideFunction: true,
    });
  } catch (e) {
    console.warn('parse skip rewrite:', e.message);
    return code;
  }

  const skip = new Set();
  const rewrites = [];

  function walk(node, locals, top) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'Identifier') {
      if (skip.has(node.start)) return;
      const name = node.name;
      if (SHARED.has(name) && !localDefs.has(name) && !locals.has(name)) {
        rewrites.push({ start: node.start, end: node.end, name });
      }
      return;
    }

    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      const child = new Set(locals);
      if (node.id?.type === 'Identifier') {
        skip.add(node.id.start);
        child.add(node.id.name);
      }
      const bind = (n) => {
        if (!n) return;
        if (n.type === 'Identifier') { child.add(n.name); skip.add(n.start); }
        else if (n.type === 'AssignmentPattern') bind(n.left);
        else if (n.type === 'RestElement') bind(n.argument);
        else if (n.type === 'ObjectPattern') n.properties.forEach((p) => (p.type === 'Property' ? bind(p.value) : bind(p.argument)));
        else if (n.type === 'ArrayPattern') n.elements.forEach(bind);
      };
      (node.params || []).forEach(bind);
      walk(node.body, child, false);
      return;
    }

    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      if (node.id) { skip.add(node.id.start); }
      const child = new Set(locals);
      if (node.id) child.add(node.id.name);
      walk(node.superClass, locals, false);
      if (node.body?.body) {
        for (const el of node.body.body) {
          if (el.key?.type === 'Identifier' && !el.computed) skip.add(el.key.start);
          walk(el.value, child, false);
          if (el.computed) walk(el.key, child, false);
        }
      }
      return;
    }

    if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) {
        const bind = (n) => {
          if (!n) return;
          if (n.type === 'Identifier') {
            skip.add(n.start);
            if (!(top && localDefs.has(n.name))) locals.add(n.name);
            // top-level localDefs: references should stay bare (lexical). Don't rewrite.
          } else if (n.type === 'AssignmentPattern') bind(n.left);
          else if (n.type === 'RestElement') bind(n.argument);
          else if (n.type === 'ObjectPattern') n.properties.forEach((p) => (p.type === 'Property' ? bind(p.value) : bind(p.argument)));
          else if (n.type === 'ArrayPattern') n.elements.forEach(bind);
        };
        bind(d.id);
        // Treat top-level localDefs as in-scope for the rest of the module
        if (top && d.id?.type === 'Identifier' && localDefs.has(d.id.name)) {
          locals.add(d.id.name);
        }
        walk(d.init, locals, false);
      }
      return;
    }

    if (node.type === 'MemberExpression') {
      walk(node.object, locals, false);
      if (node.computed) walk(node.property, locals, false);
      else if (node.property?.type === 'Identifier') skip.add(node.property.start);
      return;
    }

    if (node.type === 'Property') {
      if (!node.computed && node.key?.type === 'Identifier') skip.add(node.key.start);
      if (node.computed) walk(node.key, locals, false);
      walk(node.value, locals, false);
      return;
    }

    if (node.type === 'CatchClause') {
      const child = new Set(locals);
      if (node.param?.type === 'Identifier') { child.add(node.param.name); skip.add(node.param.start); }
      walk(node.body, child, false);
      return;
    }

    if (node.type === 'BlockStatement') {
      const child = new Set(locals);
      for (const stmt of node.body) {
        if (stmt.type === 'VariableDeclaration') {
          for (const d of stmt.declarations) {
            const bind = (n) => {
              if (!n) return;
              if (n.type === 'Identifier') child.add(n.name);
              else if (n.type === 'ObjectPattern') n.properties.forEach((p) => (p.type === 'Property' ? bind(p.value) : bind(p.argument)));
              else if (n.type === 'ArrayPattern') n.elements.forEach(bind);
              else if (n.type === 'AssignmentPattern') bind(n.left);
              else if (n.type === 'RestElement') bind(n.argument);
            };
            bind(d.id);
          }
        }
        if (stmt.type === 'FunctionDeclaration' && stmt.id) child.add(stmt.id.name);
        if (stmt.type === 'ClassDeclaration' && stmt.id) child.add(stmt.id.name);
      }
      for (const stmt of node.body) walk(stmt, child, false);
      return;
    }

    if (
      node.type === 'AssignmentExpression' &&
      node.left?.type === 'MemberExpression' &&
      node.left.object?.name === 'window' &&
      !node.left.computed &&
      node.left.property?.type === 'Identifier'
    ) {
      skip.add(node.left.property.start);
      walk(node.left.object, locals, false);
      walk(node.right, locals, false);
      return;
    }

    for (const key of Object.keys(node)) {
      if (['loc', 'range', 'start', 'end', 'raw'].includes(key)) continue;
      const val = node[key];
      if (Array.isArray(val)) val.forEach((v) => walk(v, locals, false));
      else if (val && typeof val === 'object' && val.type) walk(val, locals, false);
    }
  }

  // Seed locals with all localDefs so same-file refs stay bare
  const programLocals = new Set(localDefs);
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id) programLocals.add(node.id.name);
    if (node.type === 'ClassDeclaration' && node.id) programLocals.add(node.id.name);
  }
  walk(ast, programLocals, true);

  rewrites.sort((a, b) => b.start - a.start);
  let out = code;
  for (const r of rewrites) {
    out = `${out.slice(0, r.start)}window.${r.name}${out.slice(r.end)}`;
  }
  return out;
}

function exportToWindow(code, localDefs) {
  const assigns = [...localDefs]
    .filter((n) => /^[A-Za-z_$][\w$]*$/.test(n))
    .map((n) => `window.${n} = ${n};`)
    .join('\n');
  return `${code}\n${assigns}\n`;
}

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function writeFile(rel, content) {
  const abs = path.join(ROOT, rel);
  ensureDir(abs);
  fs.writeFileSync(abs, content);
  const loc = content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
  console.log(`${rel}: ${loc}`);
  return loc;
}

function buildModule(rel, preamble, rawBody, { exportClass = false, skipWindowExport = false } = {}) {
  // Collect function names from raw for SHARED registry
  const locals = listTopLevelDecls(rawBody);
  for (const n of locals) SHARED.add(n);

  let body = rewriteExternals(rawBody, locals);
  if (!skipWindowExport) body = exportToWindow(body, locals);

  // Re-bind mutable shared state: for `let x` that is SHARED, also keep window.x in sync
  // by converting top-level shared lets to window-backed accessors in a second pass —
  // simpler approach: convert `let foo = init` for SHARED state to window.foo = init; and
  // use window.foo everywhere in THIS file too for those state vars.
  const stateVars = [...locals].filter((n) =>
    /State$|Signals$|Pins$|Query$|Index$|Collapse|Providers$|Provider$|Manager$|Runtime$|Bridge$|omnibox$|tabSearch$|bookmarkBtn$|frameCount|lastTime|activeSection|appWindow|^invoke$/.test(n) ||
    n.startsWith('atlasSidebar') ||
    ['SETTINGS_SECTION_COLLAPSIBLE', 'settingsDensityControlConfigs', 'ATLAS_SIDEBAR_COLLAPSIBLE_SECTIONS', 'SETTINGS_SECTION_RULES', 'ATLAS_SURFACE_RULES', 'ATLAS_MANIFEST_URL', 'ATLAS_HEALTH_URL', 'searchProviders'].includes(n),
  );

  if (stateVars.length) {
    // Re-parse and force state var refs to window — by converting declarations
    let code = body;
    for (const v of stateVars) {
      // let/const v = → window.v =
      code = code.replace(new RegExp(`\\b(?:let|const|var)\\s+${v}\\s*=`, 'g'), `window.${v} =`);
      // remove redundant window.v = v;
      code = code.replace(new RegExp(`^window\\.${v} = ${v};\\s*$`, 'gm'), '');
    }
    // Rewrite bare state var identifiers to window.v (reuse rewrite with empty locals for those)
    const onlyState = new Set(stateVars);
    // Temporary: mark state as external
    const saved = new Set(locals);
    for (const v of stateVars) saved.delete(v);
    body = rewriteExternals(code.replace(/\nwindow\.\w+ = \w+;\n/g, '\n'), saved);
    // Restore function exports onto window
    const fns = [...locals].filter((n) => !stateVars.includes(n));
    body = exportToWindow(body, new Set(fns));
  }

  const content = `${preamble}\n${body}`;
  return writeFile(rel, content);
}

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
import { loadAxisManifest as loadAxisManifestFromCatalog } from '../engines/catalog-loader.js';
import './fallback-manifest.js';

console.log('Axis v0.1.0 - Initializing...');

window.ATLAS_MANIFEST_URL = './axis-manifest.json';
window.atlasRuntime = {
    manifest: null,
    capabilities: new Map()
};

window.loadAtlasManifest = async function loadAtlasManifest() {
    const atlasRuntime = window.atlasRuntime;
    const ATLAS_MANIFEST_URL = window.ATLAS_MANIFEST_URL;
    try {
        let manifest = await loadAxisManifestFromCatalog();
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
        window.axisManifest = manifest;
        window.atlasManifest = manifest;
        return manifest;
    } catch (error) {
        console.warn('Axis manifest could not be loaded:', error);
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
import { mountServerControl, unmountServerControl } from '../axis-server-control.js';
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
import { axisRuntime } from '../engines/runtime.js';
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
    `window.atlasBridge = axisRuntime;
window.axisRuntime = axisRuntime;
const atlasBridge = axisRuntime;
`,
    slice(6580, 6599),
    `window.perfMonitor = new PerformanceMonitor();
`,
  ].join('\n'),
);

fs.writeFileSync(path.join(ROOT, 'scripts/.split-shared-names.json'), JSON.stringify([...SHARED].sort(), null, 2));
console.log('done');
