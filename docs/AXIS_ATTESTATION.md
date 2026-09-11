# Axis Attestation — RNK product surfaces refuse non-Axis clients

Doctrine (2026-09-06, Odinn): **Axis is the only client.** Raven, Echonet, Mail, and the demo product surfaces are usable through Axis; their authenticated/login/API surfaces must refuse a normal browser. Public marketing GETs on `rnk-enterprise.us` may stay world-readable — **login/API may not.**

This is the whole contract. No product feature work rides on this file.

## Wire format

After an Axis session exists, requests to RNK product hosts carry:

| Header | Value |
|---|---|
| `X-Axis-Client` | `1` |
| `X-Axis-Session` | Axis session token |
| `X-Axis-Tier` | `full` \| `agent` \| `dev` |

Header names are **documented, not secret**; the session token is per-session and issued by the Axis native shell.

### Cookie bootstrap (iframes)

Product pages loaded inside Axis iframes cannot set custom headers cross-origin, so Axis exposes a bootstrap endpoint that yields a **cookie** instead:

- Native command: `attestation_bootstrap` → `{ cookie: "axis_attest", value: "axb_<expiry_ms>_<token>", maxAge, tier }`
- The page's JS sets `axis_attest` (path `/`, `SameSite=Lax`, `Secure` in production) and every subsequent request carries the attestation.
- Bootstrap values are recognizable by the `axb_` prefix and are expiry-checked by the receiving middleware; native shell tokens are lifecycle-managed by the shell.

Refusal reasons (stable strings for logs): `axis_attestation_missing`, `axis_attestation_expired`, `axis_attestation_forbidden` (tier not allowed).

## Shared middleware

`docs/axis-attestation-gate.cjs` in this repo is dependency-free (CommonJS) and is the single source of the check. Products copy or require it; it must stay under 120 LOC.

```js
const { requireAxisAttestation } = require('<Axis>/docs/axis-attestation-gate.cjs');

// Enforce now:
app.use('/api', requireAxisAttestation({ gatedPrefixes: ['/api/axis'] }));

// Log-only while a product wires up (still fail-closed by default elsewhere):
app.use('/api', requireAxisAttestation({ enforced: false }));
```

## What was wired (2026-09-06)

| Product | Hook | Mode |
|---|---|---|
| Raven | `src/app/api/axis/**/route.ts` guard helper | enforced on `/api/axis/*` |
| Echonet | `server.js` session+control API gate | enforced on session/control endpoints |
| Mail | `server/server.js` API gate | log-only rollout flag (`AXIS_ATTEST_ENFORCE=1` to enforce) |
| Website demo | `demo/server.js` API gate | log-only rollout flag (`AXIS_ATTEST_ENFORCE=1` to enforce) |

`sec.rnk-enterprise.us` (private pentest) is intentionally not reachable from the default agent chrome; Axis policy fail-closes it until Ghost chain routing is wired.

## Not in scope

- No CRM feature work, no Mail IMAP work, no marketing copy changes.
- Ghost Comms crypto, Vortex, P.R.O.T.E.C.T.S. organ internals, and D.O.M.A.I.N. are untouched by this contract.
