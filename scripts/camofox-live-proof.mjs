#!/usr/bin/env node
/**
 * Live Camofox contract proof for GENYSYS.
 * Proves hop-by-hop redirect refusal and privileged cookie import against a
 * local Camofox instance. Does not launch the Tauri shell.
 */

import http from 'node:http';
import { randomBytes } from 'node:crypto';

const ORIGIN = process.env.GENYSYS_CAMOFOX_URL || 'http://127.0.0.1:9378';
const USER_ID = 'genysys-proof';
const SESSION_KEY = 'proof-session';
const TOKEN = randomBytes(16).toString('hex');

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function camofox(method, path, body) {
  const response = await fetch(`${ORIGIN}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: response.status, json };
}

function startPolicyServer(mode) {
  const hops = [];
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/camofox/policy/check') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ decision: 'block', reason: 'path_unknown' }));
      return;
    }
    const auth = String(req.headers.authorization || '');
    if (auth !== `Bearer ${TOKEN}`) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ decision: 'block', reason: 'unauthorized' }));
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    let decision = 'allow';
    let reason = 'policy_ok';
    if (mode === 'block-after-first' && Number(body.hop) > 0) {
      decision = 'block';
      reason = 'redirect_hop_blocked';
    } else {
      try {
        const parsed = new URL(body.url);
        const host = (parsed.hostname || '').toLowerCase();
        if (
          host === '127.0.0.1'
          || host === 'localhost'
          || host === '::1'
          || host === '169.254.169.254'
        ) {
          decision = 'block';
          reason = 'blocked_host';
        } else if (parsed.protocol === 'http:') {
          decision = 'block';
          reason = 'plain_http_blocked';
        }
      } catch {
        decision = 'block';
        reason = 'url_invalid';
      }
    }
    hops.push({
      url: body.url,
      decision,
      reason,
      hop: body.hop,
      navigationType: body.navigationType,
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ decision, reason }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        hops,
        callbackUrl: `http://127.0.0.1:${port}/camofox/policy/check`,
      });
    });
  });
}

async function main() {
  console.log(`Camofox proof against ${ORIGIN}`);
  const health = await camofox('GET', '/health');
  record(
    'health',
    health.status === 200 && health.json?.ok === true && health.json?.browserConnected === true,
    JSON.stringify(health.json),
  );

  const allowPolicy = await startPolicyServer('allow-safe');
  const redirectPolicy = await startPolicyServer('block-after-first');
  try {
    const created = await camofox('POST', '/tabs', {
      userId: USER_ID,
      sessionKey: SESSION_KEY,
    });
    record(
      'create_tab',
      created.status === 200 && Boolean(created.json?.tabId),
      JSON.stringify(created.json),
    );
    const tabId = created.json?.tabId;
    if (!tabId) throw new Error('tab create failed');

    const allowed = await camofox('POST', `/tabs/${tabId}/navigate`, {
      userId: USER_ID,
      sessionKey: SESSION_KEY,
      url: 'https://example.com/',
      policyCallback: allowPolicy.callbackUrl,
      policyToken: TOKEN,
      policyTabId: 1,
    });
    record(
      'navigate_allow_with_hops',
      allowed.status === 200
        && allowed.json?.ok === true
        && Array.isArray(allowed.json?.hops)
        && allowed.json.hops.length >= 1
        && allowed.json.hops.every((hop) => hop.decision === 'allow'),
      JSON.stringify({
        status: allowed.status,
        url: allowed.json?.url,
        hops: allowed.json?.hops,
      }),
    );

    const refused = await camofox('POST', `/tabs/${tabId}/navigate`, {
      userId: USER_ID,
      sessionKey: SESSION_KEY,
      url: 'https://httpbingo.org/redirect/1',
      policyCallback: redirectPolicy.callbackUrl,
      policyToken: TOKEN,
      policyTabId: 1,
    });
    record(
      'navigate_redirect_refused',
      refused.status === 403
        && String(refused.json?.error || '').startsWith('camofox_redirect_refused:')
        && Array.isArray(refused.json?.hops)
        && refused.json.hops.some((hop) => hop.hop === 0 && hop.decision === 'allow')
        && refused.json.hops.some((hop) => hop.hop === 1 && hop.decision === 'block'),
      JSON.stringify(refused.json),
    );

    const cookieValue = `axb_${Date.now() + 8 * 3600 * 1000}_proof-token`;
    const cookies = await camofox('POST', `/sessions/${USER_ID}/cookies`, {
      cookies: [{
        name: 'genysys_attest',
        value: cookieValue,
        domain: '.rnk-enterprise.us',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 8 * 3600,
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      }],
    });
    record(
      'attestation_cookie_import',
      cookies.status === 200 && cookies.json?.ok === true && cookies.json?.count === 1,
      JSON.stringify(cookies.json),
    );
  } finally {
    allowPolicy.server.close();
    redirectPolicy.server.close();
  }

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} proofs passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
