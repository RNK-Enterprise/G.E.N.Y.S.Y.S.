# GENYSYS Attestation — RNK product surfaces refuse non-GENYSYS clients

Doctrine (2026-09-06, Odinn): **GENYSYS is the only client.** A.R.C.H., the communications platform, Mail, and the demo product surfaces are usable through GENYSYS; their authenticated/login/API surfaces must refuse a normal browser. Public marketing GETs on `rnk-enterprise.us` may stay world-readable — **login/API may not.**

This is the whole contract. No product feature work rides on this file.

## Wire format

After an GENYSYS session exists, requests to RNK product hosts carry:

| Header | Value |
|---|---|
| `X-GENYSYS-Client` | `1` |
| `X-GENYSYS-Session` | GENYSYS session token |
| `X-GENYSYS-Tier` | `full` \| `agent` \| `dev` |

Header names are **documented, not secret**; the session token is per-session and issued by the GENYSYS native shell.

### Cookie bootstrap (iframes)

Product pages loaded inside GENYSYS iframes cannot set custom headers cross-origin, so GENYSYS exposes a bootstrap endpoint that yields a **cookie** instead:

- Native command: `attestation_bootstrap` → `{ cookie: "genysys_attest", value: "axb_<expiry_ms>_<token>", maxAge, tier }`
- The page's JS sets `genysys_attest` (path `/`, `SameSite=Lax`, `Secure` in production) and every subsequent request carries the attestation.
- Bootstrap values are recognizable by the `axb_` prefix and are expiry-checked by the receiving middleware; native shell tokens are lifecycle-managed by the shell.

Refusal reasons (stable strings for logs): `genysys_attestation_missing`, `genysys_attestation_expired`, `genysys_attestation_forbidden` (tier not allowed).

## Shared middleware

`docs/genysys-attestation-gate.cjs` in this repo is dependency-free (CommonJS) and is the single source of the check. Products copy or require it; it must stay under 120 LOC.

```js
const { requireGenysysAttestation } = require('<GENYSYS>/docs/genysys-attestation-gate.cjs');

// Enforce now:
app.use('/api', requireGenysysAttestation({ gatedPrefixes: ['/api/genysys'] }));

// Log-only while a product wires up (still fail-closed by default elsewhere):
app.use('/api', requireGenysysAttestation({ enforced: false }));
```

## What was wired (2026-09-06)

| Product | Hook | Mode |
|---|---|---|
| A.R.C.H. | Product API guard helper | destination contract pending |
| Communications platform | Session/control API gate | destination contract pending |
| Mail | `server/server.js` API gate | log-only rollout flag (`GENYSYS_ATTEST_ENFORCE=1` to enforce) |
| Website demo | `demo/server.js` API gate | log-only rollout flag (`GENYSYS_ATTEST_ENFORCE=1` to enforce) |

`sec.rnk-enterprise.us` (private pentest) is intentionally not reachable from the default agent chrome; GENYSYS policy fail-closes it until Ghost chain routing is wired.

## Not in scope

- No CRM feature work, no Mail IMAP work, no marketing copy changes.
- Ghost Comms crypto, Vortex, P.R.O.T.E.C.T.S. organ internals, and D.O.M.A.I.N. are untouched by this contract.
