/**
 * Axis™ — 500 LOC cap audit (Build Rule 2)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Walks the repo (skipping dependency/vendor/build trees), counts every text
 * file's lines, and fails on any hand-written file over the 500 LOC hard cap.
 * Auto-generated files (lockfiles, the generated catalog) are exempt by rule;
 * binaries are ignored outright.
 *
 * Usage:
 *   node scripts/audit-loc.mjs            # gate mode: exit 1 on any violation
 *   node scripts/audit-loc.mjs --report   # also (re)generate LOC_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const CAP = 500;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = path.join(ROOT, 'LOC_REPORT.md');

const EXCLUDE_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'target', 'vendor', '.freebuff',
  'test-results', 'playwright-report', '.pkgconfig', 'coverage',
]);
const BINARY_EXT = new Set(['.png', '.ico', '.icns', '.jpg', '.jpeg', '.gif', '.woff', '.woff2']);
const AUTO_EXEMPT = new Set(['package-lock.json', 'Cargo.lock', 'axis-manifest.json']);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      yield path.join(dir, entry.name);
    }
  }
}

function countLines(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.length;
}

const scanned = [];
for (const abs of walk(ROOT)) {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  const ext = path.extname(rel);
  if (BINARY_EXT.has(ext)) continue;
  scanned.push({ rel, loc: countLines(abs), exempt: AUTO_EXEMPT.has(path.basename(rel)) });
}
scanned.sort((a, b) => a.rel.localeCompare(b.rel));

const violations = scanned.filter((f) => !f.exempt && f.loc > CAP);
const exempt = scanned.filter((f) => f.exempt);

function statusOf(f) {
  if (f.exempt) return 'AUTO-GENERATED — EXEMPT';
  return f.loc > CAP ? '⚠ OVER CAP' : 'OK';
}

function report() {
  const byDir = new Map();
  for (const f of scanned) {
    const dir = path.posix.dirname(f.rel);
    const key = dir === '.' ? '[ROOT]' : `${dir}/`;
    if (!byDir.has(key)) byDir.set(key, []);
    byDir.get(key).push(f);
  }
  const lines = [
    '# AXIS Platform — LOC Report',
    `**Generated:** ${new Date().toISOString().slice(0, 10)} (by scripts/audit-loc.mjs)`,
    `**LOC Cap:** ${CAP} lines per file (hard limit, hand-written files)`,
    `**Scope:** all text files, excluding target/, node_modules/, dist/, vendor/`,
    '',
  ];
  for (const [dir, files] of byDir) {
    lines.push(`## ${dir}`, '', '| File | LOC | Status |', '|---|---|---|');
    for (const f of files) lines.push(`| ${path.basename(f.rel)} | ${f.loc.toLocaleString('en-US')} | ${statusOf(f)} |`);
    lines.push('');
  }
  if (violations.length) {
    lines.push('## Over-Cap Violations (Actionable)', '', '| File | LOC | Overage |', '|---|---|---|');
    for (const f of violations) lines.push(`| ${f.rel} | ${f.loc} | +${f.loc - CAP} |`);
    lines.push('');
  }
  lines.push(`> Exempt (auto-generated): ${exempt.map((f) => `${f.rel} (${f.loc.toLocaleString('en-US')})`).join(', ') || 'none'}`, '');
  fs.writeFileSync(REPORT, lines.join('\n'));
}

const total = scanned.reduce((sum, f) => sum + f.loc, 0);
console.log(`audit-loc: ${scanned.length} files, ${total.toLocaleString('en-US')} LOC, cap ${CAP}`);
for (const f of violations) {
  console.log(`  OVER CAP: ${f.rel} — ${f.loc} LOC (+${f.loc - CAP})`);
}
for (const f of exempt) {
  console.log(`  exempt (auto-generated): ${f.rel} (${f.loc.toLocaleString('en-US')} LOC)`);
}
if (process.argv.includes('--report')) report();

if (violations.length) {
  console.error(`audit-loc: FAILED — ${violations.length} file(s) over the ${CAP} LOC cap. Split meaningfully before landing.`);
  process.exit(1);
}
console.log('audit-loc: OK — every hand-written file within cap');
