# VEIL Attestation — RNK product surfaces refuse non-VEIL clients

Doctrine (2026-09-06, Odinn): **VEIL is the only client.** Raven, Echonet, Mail, and the demo product surfaces are usable through VEIL; their authenticated/login/API surfaces must refuse a normal browser. Public marketing GETs on `rnk-enterprise.us` may stay world-readable — **login/API may not.**

This is the whole contract. No product feature work rides on this file.

## Wire format

After an VEIL session exists, requests to RNK product hosts carry:

| Header | Value |
|---|---|
| `X-VEIL-Client` | `1` |
| `X-VEIL-Session` | VEIL session token |
| `X-VEIL-Tier` | `full` \| `agent` \| `dev` |

Header names are **documented, not secret**; the session token is per-session and issued by the VEIL native shell.

### Cookie bootstrap (iframes)

Product pages loaded inside VEIL iframes cannot set custom headers cross-origin, so VEIL exposes a bootstrap endpoint that yields a **cookie** instead:

- Native command: `attestation_bootstrap` → `{ cookie: "veil_attest", value: "axb_<expiry_ms>_<token>", maxAge, tier }`
- The page's JS sets `veil_attest` (path `/`, `SameSite=Lax`, `Secure` in production) and every subsequent request carries the attestation.
- Bootstrap values are recognizable by the `axb_` prefix and are expiry-checked by the receiving middleware; native shell tokens are lifecycle-managed by the shell.

Refusal reasons (stable strings for logs): `veil_attestation_missing`, `veil_attestation_expired`, `veil_attestation_forbidden` (tier not allowed).

## Shared middleware

`docs/veil-attestation-gate.cjs` in this repo is dependency-free (CommonJS) and is the single source of the check. Products copy or require it; it must stay under 120 LOC.

```js
const { requireveilAttestation } = require('<VEIL>/docs/veil-attestation-gate.cjs');

// Enforce now:
app.use('/api', requireveilAttestation({ gatedPrefixes: ['/api/veil'] }));

// Log-only while a product wires up (still fail-closed by default elsewhere):
app.use('/api', requireveilAttestation({ enforced: false }));
```

## What was wired (2026-09-06)

| Product | Hook | Mode |
|---|---|---|
| Raven | `src/app/api/veil/**/route.ts` guard helper | enforced on `/api/veil/*` |
| Echonet | `server.js` session+control API gate | enforced on session/control endpoints |
| Mail | `server/server.js` API gate | log-only rollout flag (`VEIL_ATTEST_ENFORCE=1` to enforce) |
| Website demo | `demo/server.js` API gate | log-only rollout flag (`VEIL_ATTEST_ENFORCE=1` to enforce) |

`sec.rnk-enterprise.us` (private pentest) is intentionally not reachable from the default agent chrome; VEIL policy fail-closes it until Ghost chain routing is wired.

## Not in scope

- No CRM feature work, no Mail IMAP work, no marketing copy changes.
- Ghost Comms crypto, Vortex, P.R.O.T.E.C.T.S. organ internals, and D.O.M.A.I.N. are untouched by this contract.
