# Agent notes — VEIL

- Work only under `/mnt/external/VEIL`.
- Standalone first: no Atlas, Echonet, Raven, or Ghost required to boot or browse.
- Lisa policy is fail-closed. Never reintroduce fail-open.
- Engines/turbos live in-repo (`public/veil-manifest.json`, `src/engines`, `src/turbos`).
- LOC cap 500 for hand-written files; generated catalog and lockfiles exempt.
- Evidence goes to `memory/` additive only.
