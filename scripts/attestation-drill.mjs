#!/usr/bin/env node
/**
 * GENYSYS Attestation End-to-End Drill.
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Simulates an GENYSYS session (minting attestations exactly the way the native
 * `attestation_bootstrap` command does — `axb_<expiry>_<token>` cookie plus
 * the three documented headers), then hits gated RNK product APIs with and
 * without attestation and reports which refuse correctly.
 *
 * Classification (docs/GENYSYS_ATTESTATION.md):
 *   REFUSED  = 401 with genysys_attestation_missing / _expired, or 403 _forbidden
 *   ALLOWED  = anything else (auth failure with a different shape still counts
 *              as passing the gate, but is labeled to spot sloppy refusals)
 *
 * Usage: node scripts/attestation-drill.mjs
 * Ports default to the drill side-ports (see DRILLS below).
 */
import { request } from 'node:http';

const NOW = Date.now();
const TOKEN = 'drill-token-abcdef';

function bootstrapValue(ttlMs) {
  // Identical to Rust attestation::bootstrap_json: axb_<expiry_ms>_<token>
  return `axb_${NOW + ttlMs}_${TOKEN}`;
}

const VALID = bootstrapValue(60 * 60 * 1000);      // 1h
const EXPIRED = bootstrapValue(-60 * 1000);        // expired 1m ago

function headersFor(kind) {
  switch (kind) {
    case 'none':
      return {};
    case 'headers':
      return {
        'x-genysys-client': '1',
        'x-genysys-session': TOKEN,
        'x-genysys-tier': 'agent',
      };
    case 'cookie':
      return { cookie: `genysys_attest=${VALID}` };
    case 'expired':
      return { cookie: `genysys_attest=${EXPIRED}` };
    case 'badtier':
      return {
        'x-genysys-client': '1',
        'x-genysys-session': TOKEN,
        'x-genysys-tier': 'agency', // not allowed
      };
    default:
      throw new Error(`unknown kind ${kind}`);
  }
}

function hit(port, path, method = 'GET', extraHeaders = {}, body = null) {
  return new Promise((resolve) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        timeout: 4000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let reason = null;
          try { reason = JSON.parse(data)?.reason ?? null; } catch { /* non-JSON */ }
          resolve({ status: res.statusCode, reason, body: data.slice(0, 120) });
        });
      },
    );
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, reason: 'timeout' }); });
    req.on('error', (e) => resolve({ status: 0, reason: e.code || 'error' }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const CONTRACT_REASONS = ['genysys_attestation_missing', 'genysys_attestation_expired', 'genysys_attestation_forbidden'];

function gateRefused(r) {
  return (r.status === 401 || r.status === 403) && CONTRACT_REASONS.includes(r.reason);
}

function classify(r) {
  if (r.status === 401 && r.reason === 'genysys_attestation_missing') return 'GATE REFUSED (missing)';
  if (r.status === 401 && r.reason === 'genysys_attestation_expired') return 'GATE REFUSED (expired)';
  if (r.status === 403 && r.reason === 'genysys_attestation_forbidden') return 'GATE REFUSED (forbidden tier)';
  if (gateRefused(r)) return `GATE REFUSED (${r.reason})`;
  if (r.status === 401 || r.status === 403) return `gate passed → downstream auth (${r.status})`;
  return `gate passed → handler (${r.status})`;
}

// [product, port, method, path, body, expectGate]
// expectGate=true  → the gate must refuse unattested/expired/bad-tier requests
//                    with contract reasons, and PASS valid attestations.
// expectGate=false → log-only rollout: the gate must refuse NOTHING.
const DRILLS = [
  ['Echonet', 3111, 'GET', '/api/control/poll', null, true],
  ['Echonet', 3111, 'POST', '/api/control/push', { lines: [] }, true],
  ['Echonet', 3111, 'POST', '/api/session/close', {}, true],
  ['Mail log-only', 8900, 'GET', '/api/mailbox/folders', null, false],
  ['Mail enforce', 8901, 'GET', '/api/mailbox/folders', null, true],
  ['Mail enforce', 8901, 'POST', '/api/auth/login', { email: 'x@y.z', password: 'nope' }, true],
  ['Demo log-only', 3021, 'GET', '/api/counter', null, false],
  ['Demo enforce', 3022, 'GET', '/api/counter', null, true],
  ['Demo enforce', 3022, 'POST', '/api/orgs', { name: 'x' }, true],
  ['Raven', 3002, 'GET', '/api/genysys/access-request', null, true],
  ['Raven', 3002, 'POST', '/api/genysys/access-request', { domain: 'x' }, true],
  ['Raven', 3002, 'GET', '/api/genysys/auth-list', null, true],
];

const KINDS = ['none', 'headers', 'cookie', 'expired', 'badtier'];

const results = [];
for (const [product, port, method, path, body, expectGate] of DRILLS) {
  for (const kind of KINDS) {
    const r = await hit(port, path, method, headersFor(kind), body);
    results.push({ product, port, method, path, kind, expectGate, status: r.status, reason: r.reason, verdict: classify(r) });
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
console.log('\n=== GENYSYS Attestation End-to-End Drill ===\n');
for (const product of [...new Set(results.map((r) => r.product))]) {
  console.log(`\n## ${product}`);
  for (const r of results.filter((x) => x.product === product)) {
    const line = `  ${r.kind.padEnd(8)} ${r.method.padEnd(4)} ${r.path.padEnd(28)} -> ${String(r.status).padEnd(4)} ${r.verdict}`;
    console.log(line);
    const refused = gateRefused(r);
    const validKind = r.kind === 'headers' || r.kind === 'cookie';
    let ok;
    if (!r.expectGate) {
      // log-only rollout: the gate must never refuse with contract reasons
      ok = !refused;
    } else if (validKind) {
      // valid attestation: gate must pass it (downstream may still 401 on its own auth)
      ok = !refused;
    } else {
      // none/expired/badtier: gate must refuse WITH contract reasons
      ok = refused;
    }
    if (ok) pass++; else { fail++; console.log('    !! GATE BEHAVIOR WRONG'); }
  }
}

console.log(`\n=== Score: ${pass} pass / ${fail} fail ===\n`);
process.exit(fail > 0 ? 1 : 0);
