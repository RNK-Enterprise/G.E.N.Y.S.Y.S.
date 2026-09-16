#!/usr/bin/env node
/**
 * VEIL — global-wiring audit (build gate).
 *
 * Catches the "unwired global" bug class that shipped twice: the splitter
 * rewrote call sites to `window.foo` / bare `foo` without anything ever
 * assigning them (window.tauriInvoke crashed closeTab; getSearchProviderLabel
 * was one re-render away from the same crash).
 *
 * What it does:
 *   1. Parses every src JS file into an AST and tracks every `window.X`
 *      (and `globalThis.X`) property: reads, writes, deletes — with
 *      guard-awareness (`typeof window.X`, `window.X?.()`, `if (window.X)`,
 *      logical-left tests are *guarded* reads; a bare `window.X(...)` call is
 *      not).
 *   2. Runs ESLint no-undef over the same files to find bare identifiers that
 *      resolve to nothing at parse scope (they can only work if some module
 *      publishes a matching `window.X` global at runtime).
 *   3. Fails when a name is read but provided by nothing:
 *        - window.X read (unguarded) with no window.X assignment anywhere,
 *          and X is not a known browser/Tauri built-in  → exit 1
 *        - bare name flagged by no-undef with no `window.name` assignment
 *          and no bare `name = …` global write anywhere            → exit 1
 *      A write only counts as a provider when it really publishes a value:
 *      `window.X = X` with no local `X` is a self-assignment whose right-hand
 *      side is the same undefined name (ReferenceError at module load, as
 *      `window.setVEILSidebarStateBadges` did), so it never excuses a read.
 *      Guarded reads with no provider are extension points by design —
 *      reported as info, never fatal.
 *
 * Baseline: scripts/.window-globals-baseline.json maps known-accepted names
 * to a reason (`node scripts/audit-window-globals.mjs --update-baseline`
 * regenerates it). Keep it empty; every entry is debt with a name on it.
 *
 * Wired as `prebuild:vite`, so `npm run build:vite` (and therefore the Tauri
 * beforeBuildCommand) cannot bundle an unwired global.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import { Linter } from 'eslint';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '.window-globals-baseline.json');

// ── Names the runtime provides outside our code ───────────────────────────────
const BUILTINS = new Set([
  // DOM / browser API surface the shell touches or may touch
  'addEventListener', 'removeEventListener', 'dispatchEvent', 'close', 'open',
  'confirm', 'alert', 'prompt', 'focus', 'blur', 'print', 'stop',
  'scroll', 'scrollTo', 'scrollBy', 'scrollX', 'scrollY', 'innerWidth', 'innerHeight',
  'outerWidth', 'outerHeight', 'devicePixelRatio', 'screenX', 'screenY', 'screen',
  'location', 'history', 'navigator', 'document', 'frames', 'self', 'top', 'parent',
  'opener', 'name', 'origin', 'status', 'closed', 'length', 'visualViewport',
  'performance', 'getComputedStyle', 'matchMedia', 'requestAnimationFrame',
  'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'crypto', 'atob', 'btoa',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'SharedWorker', 'MessageChannel',
  'postMessage', 'structuredClone', 'Blob', 'File', 'FileReader', 'FormData',
  'Headers', 'Request', 'Response', 'URL', 'URLSearchParams', 'AbortController',
  'TextEncoder', 'TextDecoder', 'CustomEvent', 'Event', 'EventTarget', 'ErrorEvent',
  'PromiseRejectionEvent', 'DOMParser', 'XMLSerializer', 'Node', 'NodeFilter',
  'Element', 'HTMLElement', 'Image', 'Option', 'CSS', 'getSelection', 'find',
  'ResizeObserver', 'IntersectionObserver', 'MutationObserver', 'customElements',
  'console', 'reportError', 'gc', 'trustedTypes', 'styleMedia', 'external',
  'onload', 'onerror', 'onbeforeunload', 'onunload', 'onmessage', 'onresize',
  'isSecureContext', 'crossOriginIsolated', 'serviceWorker',
  // Tauri injects these into every webview at runtime
  '__TAURI__', '__TAURI_IPC__', '__TAURI_METADATA__', '__TAURI_PATTERN__',
  '__TAURI_ISOLATION__', '__TAURI_INTERNALS__',
]);

// ── File collection ───────────────────────────────────────────────────────────
function listJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out.sort();
}

// ── AST walking (assigns parent pointers) ─────────────────────────────────────
function walk(node, parent = null) {
  node.parent = parent;
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
    const v = node[key];
    if (Array.isArray(v)) {
      for (const c of v) if (c && typeof c === 'object' && typeof c.type === 'string') walk(c, node);
    } else if (v && typeof v === 'object' && typeof v.type === 'string') {
      walk(v, node);
    }
  }
}

/**
 * True when `node` is a FIRST-LEVEL window property (`window.X`,
 * `window?.X`, `globalThis.X`). Multi-hop chains (`window.tabManager.tabs`)
 * are properties of some object, not window globals — only the direct
 * object being the window identifier counts.
 */
function windowBase(node) {
  const cur = node.object;
  return cur.type === 'Identifier' && (cur.name === 'window' || cur.name === 'globalThis') ? cur.name : null;
}

function propName(node) {
  if (!node.computed) return node.property.type === 'Identifier' ? node.property.name : null;
  const p = node.property;
  return p.type === 'Literal' && typeof p.value === 'string' ? p.value : null;
}

/**
 * Direct guard on the read chain itself: the access is null-safe or sits in
 * a checked position. True for: optional access on/after X (`window.X?.y`,
 * `window.X?.()`), typeof tests on X, and X as a logical-left / if / ternary
 * test (evaluating it can't throw; the check IS the guard).
 */
function isDirectlyGuarded(node) {
  if (node.optional) return true; // window?.X — the access itself short-circuits
  let cur = node;
  for (;;) {
    const p = cur.parent;
    if (!p) return false;
    if (p.type === 'MemberExpression' && p.object === cur) {
      if (p.optional) return true; // window.X?.y — X missing → chain yields undefined
      cur = p;
      continue;
    }
    if (p.type === 'CallExpression' && p.callee === cur) {
      if (p.optional) return true; // window.X?.() — null-safe call
      cur = p;
      continue; // plain call keeps chain context
    }
    if (p.type === 'ChainExpression') { cur = p; continue; }
    if (p.type === 'UnaryExpression' && p.operator === 'typeof') return true;
    if (p.type === 'LogicalExpression' && p.left === cur) return true;
    if (p.type === 'IfStatement' && p.test === cur) return true;
    if (p.type === 'ConditionalExpression' && p.test === cur) return true;
    return false;
  }
}

/**
 * Does `subtree` reference `window.<name>`? negated = every reference sits
 * under an odd number of `!` unwraps. Descends everything except into a
 * matched member's deeper chain (`window.X.y` is not another `window.X` ref).
 */
function referencesGlobal(subtree, name) {
  let pos = 0;
  let neg = 0;
  const visit = (n, bangs) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'MemberExpression') {
      const o = n.object;
      if (o.type === 'Identifier' && (o.name === 'window' || o.name === 'globalThis') && propName(n) === name) {
        if (bangs % 2 === 1) neg += 1;
        else pos += 1;
        return;
      }
    }
    if (n.type === 'UnaryExpression' && n.operator === '!') {
      visit(n.argument, bangs + 1);
      return;
    }
    for (const key of Object.keys(n)) {
      if (key === 'parent' || key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
      const v = n[key];
      if (Array.isArray(v)) {
        for (const c of v) visit(c, bangs);
      } else if (v && typeof v.type === 'string') {
        visit(v, bangs);
      }
    }
  };
  visit(subtree, 0);
  return { found: pos + neg > 0, negated: pos === 0 && neg > 0 };
}

/** Direct child of `ancestor` on the parent chain from `node`, or null. */
function branchChildOf(node, ancestor) {
  let cur = node;
  while (cur && cur.parent !== ancestor) cur = cur.parent;
  return cur && cur.parent === ancestor ? cur : null;
}

/** Is `node` inside `subtree` (climbing parents, not passing `stopAt`)? */
function isInside(node, subtree, stopAt) {
  for (let c = node; c && c !== stopAt; c = c.parent) {
    if (c === subtree) return true;
  }
  return false;
}

/**
 * Branch-aware guard: the enclosing control flow already proved X exists.
 *   if (typeof window.X === 'function') { window.X() }   → guarded
 *   if (window.X) { window.X.y }                          → guarded
 *   window.X && window.X(...)                             → guarded
 *   if (!window.X) {…} else { window.X() }                → guarded (else branch)
 * but the read inside the *falsy* branch of its own negated check is not.
 */
function isControlFlowGuarded(node, name) {
  let cur = node;
  while (cur.parent) {
    const p = cur.parent;
    if (p.type === 'IfStatement' || p.type === 'ConditionalExpression') {
      if (isInside(cur, p.test, p)) return true; // the read is part of the check itself
      const { found, negated } = referencesGlobal(p.test, name);
      if (found) {
        const child = branchChildOf(cur, p);
        const inConsequent = child !== null && child === p.consequent;
        const inAlternate = child !== null && p.alternate != null && child === p.alternate;
        return negated ? inAlternate : inConsequent;
      }
    } else if (p.type === 'LogicalExpression' && p.operator === '&&') {
      if (isInside(cur, p.left, p)) return true; // read is the guard itself
      if (referencesGlobal(p.left, name).found) return true; // right side runs only when left held
    }
    cur = p;
  }
  return false;
}

/** First property name off the window identifier in a member chain, or null. */
function rootPropName(node) {
  let cur = node;
  while (cur.type === 'MemberExpression' && cur.object.type === 'MemberExpression') cur = cur.object;
  return cur.type === 'MemberExpression' ? propName(cur) : null;
}

// ── Pass 1: AST scan of window.* reads/writes + bare global writes ────────────
// names: Map<name, { reads: [{file,line,guarded}], writes, deletes, selfWrites }>
const names = new Map();
const bareWrites = new Set();
const parseErrors = [];
const localDecls = new Map(); // file → names bound in that module's own scope

/**
 * Names bound in a module's own scope (function/class declarations, `var`/
 * `let`/`const`, imports). A named function *expression* does not count: its
 * name is visible only inside itself, so `window.X = function X(){}` followed
 * by a bare `X` works only because the window property already exists.
 */
function collectLocalDeclarations(ast) {
  const decls = new Set();
  for (const node of walkAll(ast)) {
    if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) {
      decls.add(node.id.name);
    } else if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) if (d.id.type === 'Identifier') decls.add(d.id.name);
    } else if (node.type === 'ImportDeclaration') {
      for (const s of node.specifiers) if (s.local) decls.add(s.local.name);
    }
  }
  return decls;
}

/**
 * `writes` counts *real* providers only. A self-assignment publishes nothing
 * (its value is the same undefined name), so it is tracked separately as
 * `selfWrites` and never excuses a read.
 */
function record(name, kind, file, line, guarded) {
  let e = names.get(name);
  if (!e) names.set(name, (e = { reads: [], writes: 0, deletes: 0, selfWrites: [] }));
  if (kind === 'read') e.reads.push({ file, line, guarded });
  else if (kind === 'write') e.writes += 1;
  else if (kind === 'self-write') e.selfWrites.push({ file, line });
  else if (kind === 'delete') e.deletes += 1;
}

const files = listJsFiles(SRC);
const linter = new Linter({ cwd: ROOT });
const noUndef = new Map(); // name -> [{file,line}]
const lintParseFailures = [];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  let code;
  let ast;
  try {
    code = readFileSync(file, 'utf8');
    ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  } catch (err) {
    parseErrors.push(`${rel}: ${err.message}`);
    continue;
  }
  walk(ast);
  localDecls.set(rel, collectLocalDeclarations(ast));

  for (const node of walkAll(ast)) {
    if (node.type === 'MemberExpression') {
      if (!windowBase(node)) continue;
      const prop = propName(node);
      if (!prop || prop === '__proto__') continue;
      const p = node.parent;
      const line = node.loc.start.line;
      // Deep chain (window.a.b): the crash class is the ROOT (a) being
      // unwired — `.b` is not a window global itself, and assigning it
      // (`window.a.b = 1`) still requires `a` to exist.
      const deep = node.object.type === 'MemberExpression';
      const isWriteTarget = !deep && p.type === 'AssignmentExpression' && p.left === node;
      const isUpdateTarget = !deep && p.type === 'UpdateExpression' && p.argument === node;
      if (isWriteTarget || isUpdateTarget) {
        // `=` and compound ops (`+=`) both establish X at runtime — unless the
        // right-hand side is the same bare name and nothing in this module
        // declares it: `window.X = X;` then reads an undefined X and throws
        // before the module finishes loading.
        const selfAssignment =
          isWriteTarget &&
          p.operator === '=' &&
          p.right.type === 'Identifier' &&
          p.right.name === prop &&
          !(localDecls.get(rel)?.has(prop) ?? false);
        record(prop, selfAssignment ? 'self-write' : 'write', rel, line);
      } else if (!deep && p.type === 'UnaryExpression' && p.operator === 'delete' && p.argument === node) {
        record(prop, 'delete', rel, line);
      } else {
        const readName = deep ? rootPropName(node) : prop;
        if (!readName || readName === '__proto__') continue;
        const guardNode = deep ? node.object : node;
        const guarded =
          isDirectlyGuarded(guardNode) || isControlFlowGuarded(guardNode, readName);
        record(readName, 'read', rel, line, guarded);
      }
    } else if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') {
      // Bare `name = …` (implicit global in sloppy scripts; throws in modules —
      // tracked only so a no-undef name can be excused if some script does it).
      bareWrites.add(node.left.name);
    }
  }

  // Pass 2: eslint no-undef for bare identifiers.
  try {
    const messages = linter.verify(
      code,
      {
        parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
        env: { browser: true, es2022: true },
        rules: { 'no-undef': 'error' },
      },
      { filename: rel },
    );
    for (const m of messages) {
      if (m.ruleId !== 'no-undef') continue;
      const name = /'(.+?)' is not defined/.exec(m.message)?.[1];
      if (!name) continue;
      if (!noUndef.has(name)) noUndef.set(name, []);
      noUndef.get(name).push({ file: rel, line: m.line });
    }
  } catch (err) {
    lintParseFailures.push(`${rel}: ${err.message}`);
  }
}

function* walkAll(ast) {
  const stack = [ast];
  while (stack.length) {
    const n = stack.pop();
    if (!n || typeof n.type !== 'string') continue;
    yield n;
    for (const key of Object.keys(n)) {
      if (key === 'parent' || key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
      const v = n[key];
      if (Array.isArray(v)) {
        for (const c of v) {
          if (c && typeof c.type === 'string') stack.push(c);
        }
      } else if (v && typeof v.type === 'string') {
        stack.push(v);
      }
    }
  }
}

// ── Pass 3: classify ──────────────────────────────────────────────────────────
let baseline = {};
if (existsSync(BASELINE_PATH)) {
  try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).allow ?? {}; } catch { baseline = {}; }
}

const failures = [];
const extensionPoints = [];

for (const [name, e] of names) {
  if (e.writes > 0 || e.deletes > 0) continue; // provided (or explicitly managed) somewhere
  if (BUILTINS.has(name)) continue;
  const unguarded = e.reads.filter((r) => !r.guarded);
  const tag = `window.${name}`;
  if (unguarded.length > 0) {
    if (baseline[tag]) {
      extensionPoints.push(`${tag} — baselined: ${baseline[tag]}`);
      continue;
    }
    failures.push({
      tag,
      name,
      kind: 'unguarded-read-no-provider',
      detail: unguarded.slice(0, 5).map((r) => `${r.file}:${r.line}`),
      more: unguarded.length - 5,
    });
  } else {
    extensionPoints.push(
      `${tag} — optional hook (${e.reads.length} guarded read${e.reads.length === 1 ? '' : 's'}, no provider)`,
    );
  }
}

for (const [name, sites] of noUndef) {
  if (names.get(name)?.writes > 0 || bareWrites.has(name)) continue; // published at runtime
  if (BUILTINS.has(name)) continue;
  const tag = `${name} (bare)`;
  if (baseline[tag]) {
    extensionPoints.push(`${tag} — baselined: ${baseline[tag]}`);
    continue;
  }
  failures.push({
    tag,
    name,
    kind: 'no-undef-no-provider',
    detail: sites.slice(0, 5).map((s) => `${s.file}:${s.line}`),
    more: sites.length - 5,
  });
}

// ── Report ────────────────────────────────────────────────────────────────────
const readCount = [...names.values()].reduce((n, e) => n + e.reads.length, 0);
const writeCount = [...names.values()].reduce((n, e) => n + e.writes, 0);
console.log(`audit-window-globals: ${files.length} files, ${names.size} window.* names (${readCount} reads, ${writeCount} writes/deletes)`);

if (parseErrors.length || lintParseFailures.length) {
  for (const e of [...parseErrors, ...lintParseFailures]) console.error(`  PARSE FAIL ${e}`);
  console.error('audit-window-globals: FAILED — files did not parse; fix before building.');
  process.exit(1);
}

if (updateBaselineRequested()) {
  const allow = {};
  for (const f of failures) allow[f.tag] = 'auto-baselined — replace with a real reason';
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ comment: 'Names accepted despite having no provider. Every entry is debt — keep this short.', allow }, null, 2)}\n`);
  console.log(`audit-window-globals: baseline updated (${Object.keys(allow).length} entries) → ${path.relative(ROOT, BASELINE_PATH)}`);
  process.exit(0);
}

for (const f of failures) {
  console.error(`  FAIL ${f.tag} — read but never provided (${f.kind})`);
  for (const d of f.detail) console.error(`       at ${d}`);
  if (f.more > 0) console.error(`       … and ${f.more} more`);
  for (const hint of selfAssignmentHints(f.name)) console.error(`       ${hint}`);
}
for (const e of extensionPoints) console.log(`  info ${e}`);

if (failures.length > 0) {
  console.error(`\naudit-window-globals: FAILED — ${failures.length} unwired global(s). Assign it (window.X = …), guard the read (window.X?.()), or baseline it with a reason.`);
  process.exit(1);
}
console.log('audit-window-globals: OK — every read global is provided (or an intentional, guarded extension point).');

function updateBaselineRequested() {
  return process.argv.includes('--update-baseline');
}

/** Self-assignments (`window.X = X` with no local X) publish nothing. */
function selfAssignmentHints(name) {
  const e = names.get(name);
  if (!e || e.writes > 0 || e.selfWrites.length === 0) return [];
  return e.selfWrites.map(
    (s) => `note: ${s.file}:${s.line} assigns \`window.${name} = ${name}\` — the right-hand side is that same undefined name`,
  );
}
