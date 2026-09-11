/**
 * Axis Attestation Gate — shared, dependency-free (CJS + ESM compatible).
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * The ONLY check RNK products are asked to make against non-Axis clients:
 * an authenticated/login/API request must carry an Axis attestation, or it
 * is refused. No product feature work — this is a refuse-if-missing hook.
 *
 * Wire-up (see docs/AXIS_ATTESTATION.md for the full contract):
 *   const { requireAxisAttestation } = require('<path>/axis-attestation-gate.cjs');
 *   app.use('/api', requireAxisAttestation({ gatedPrefixes: [...] }));
 */
'use strict';

const CLIENT_HEADER = 'x-axis-client';
const SESSION_HEADER = 'x-axis-session';
const TIER_HEADER = 'x-axis-tier';
const COOKIE_NAME = 'axis_attest';

const REASON_MISSING = 'axis_attestation_missing';
const REASON_EXPIRED = 'axis_attestation_expired';
const REASON_FORBIDDEN = 'axis_attestation_forbidden';

function readCookie(req, name) {
  const raw = req.headers && req.headers.cookie;
  if (!raw) return null;
  for (const part of String(raw).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

function readHeader(req, name) {
  const v = req.headers && req.headers[name];
  if (Array.isArray(v)) return v[0] || null;
  return (typeof v === 'string' && v.trim()) ? v.trim() : null;
}

function extractAttestation(req) {
  let client = readHeader(req, CLIENT_HEADER);
  let session = readHeader(req, SESSION_HEADER);
  let tier = readHeader(req, TIER_HEADER) || '';

  const cookie = readCookie(req, COOKIE_NAME);
  if (cookie && cookie.startsWith('axb_')) {
    // Format: axb_<expiry_ms>_<token>
    const rest = cookie.slice(4);
    const underscore = rest.indexOf('_');
    if (underscore > 0) {
      const exp = Number(rest.slice(0, underscore));
      if (Number.isFinite(exp)) {
        if (!session) session = cookie;
        if (!client) client = '1'; // cookie only travels via Axis bootstrap
        if (!tier) tier = 'agent';
      }
    }
  }

  if (!client || !session) return null;
  return { client, session, tier };
}

function attestationExpired(att, nowMs) {
  if (att.session.startsWith('axb_')) {
    const rest = att.session.slice(4);
    const underscore = rest.indexOf('_');
    if (underscore > 0) {
      const exp = Number(rest.slice(0, underscore));
      if (Number.isFinite(exp) && nowMs >= exp) return true;
      return false;
    }
  }
  return false; // native shell tokens: shell owns their lifecycle
}

/**
 * Express/connect middleware.
 * opts.enforced (default true) — set false to log-only while products wire up.
 * opts.allowedTiers — array; default ['agent', 'full', 'dev'].
 */
function requireAxisAttestation(opts = {}) {
  const enforced = opts.enforced !== false;
  const allowedTiers = (opts.allowedTiers || ['agent', 'full', 'dev']).map((t) => t.toLowerCase());
  const gatedPrefixes = opts.gatedPrefixes || null; // null = all /api paths

  return function axisAttestationMiddleware(req, res, next) {
    const path = req.path || (req.url || '').split('?')[0];

    // Explicit opt-out for surfaces that must stay public.
    if (gatedPrefixes && !gatedPrefixes.some((p) => path === p || path.startsWith(p + '/'))) {
      return next();
    }

    const att = extractAttestation(req);
    const now = Date.now();

    if (!att) {
      if (!enforced) return next();
      res.status(401).json({ error: 'Axis client required', reason: REASON_MISSING });
      return;
    }
    if (attestationExpired(att, now)) {
      if (!enforced) return next();
      res.status(401).json({ error: 'Axis attestation expired', reason: REASON_EXPIRED });
      return;
    }
    if (!allowedTiers.includes(att.tier.toLowerCase())) {
      if (!enforced) return next();
      res.status(403).json({ error: 'Axis tier not authorized', reason: REASON_FORBIDDEN });
      return;
    }
    next();
  };
}

module.exports = {
  requireAxisAttestation,
  extractAttestation,
  attestationExpired,
  CLIENT_HEADER,
  SESSION_HEADER,
  TIER_HEADER,
  COOKIE_NAME,
  REASON_MISSING,
  REASON_EXPIRED,
  REASON_FORBIDDEN,
};
