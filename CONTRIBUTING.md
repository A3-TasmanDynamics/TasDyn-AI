# Contributing to TasDyn-AI

## Branching

- `main` is always deployable. Nobody commits to it directly, including maintainers.
- Branch names are prefixed by intent: `feature/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`.

## Pull requests

- Every change lands via PR, reviewed before merge.
- Run `npm run typecheck` before opening a PR.
- New Discord functionality goes in `modules/<name>/` following the self-registering
  `ModuleConfig` pattern (`moduleLoader.ts` auto-discovers `modules/*/index.ts` — no other file
  needs to change to add one). Cross-cutting process concerns that aren't Discord
  commands/events (like the HTTP API server in `core/apiServer.ts`) live in `core/` instead.

## Delivery board

Every issue and PR opened anywhere in the `A3-TasmanDynamics` org is auto-added to the
[Tasman Dynamics — Delivery Board](https://github.com/orgs/A3-TasmanDynamics/projects/1) via
`.github/workflows/sync-to-project.yml`.
