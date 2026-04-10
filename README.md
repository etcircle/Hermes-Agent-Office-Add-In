# Hermes-Agent-Office-Add-In

Public Microsoft Office add-ins for Hermes Agent.

This repo is the clean public successor to the internal Office experiments. The goal is brutally simple: make Word, PowerPoint, Excel, and Outlook add-ins easy to run locally, easy to sideload, and easy to connect to a Hermes backend without shoving secrets into the browser.

## Current status

Scaffolded repository with:
- workspace layout for shared code + app-specific add-ins
- localhost-first manifest templates for Word, PowerPoint, Excel, and Outlook
- Phase 1 bridge server for `/health`, `/auth/*`, and `/api/*`
- architecture docs for backend/gateway integration
- SSH tunneling guidance for remote Hermes deployments
- public-safe env contract for the local bridge server

## Product decisions

These are now first-class repo decisions, not loose notes:
- default HTTPS port is `3446`
- this must stay native Hermes, not OpenClaw-in-drag
- `openclaw-office` is reference material only
- assets and templates should become user-owned primitives, not hardcoded consultancy baggage
- research/search + save flows should be first-class in Word, Outlook, and PowerPoint
- Mermaid stays as the default visual path; draw.io is out for the public baseline

See:
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT-DECISIONS.md`
- `docs/SSH-TUNNELING.md`
- `docs/specs/2026-04-10-office-platform-direction.md`
- `docs/plans/2026-04-10-phase-1-bridge.md`
- `docs/plans/2026-04-10-office-platform-implementation.md`

## Recommended architecture

Do not clone `openclaw-office` blindly. That codebase has useful patterns, but it also carries product drift, stale docs, company baggage, and auth assumptions that do not belong in a public Hermes repo.

The right shape is:
1. Office add-in frontend in this repo
2. thin local bridge server on `https://localhost:3446`
3. Hermes API / gateway behind that bridge on `http://127.0.0.1:8642` by default
4. browser never sees long-lived backend secrets
5. manifests default to localhost, with tunneling as an optional dev convenience

## Planned apps

- Outlook: email assistance, thread context, draft/reply workflows, research/save
- Word: authoring, rewriting, insertion, document-aware chat, research/save
- PowerPoint: deck generation, slide refinement, Mermaid visuals, template/assets flows, research/save
- Excel: formula help, analysis, planning, table/chart actions

## Repo layout

```text
packages/
  shared/        shared types, auth, client, UI primitives
  word/          Word add-in
  powerpoint/    PowerPoint add-in
  excel/         Excel add-in
  outlook/       Outlook add-in
docs/
  ARCHITECTURE.md
  PRODUCT-DECISIONS.md
  SSH-TUNNELING.md
  ROADMAP.md
scripts/
  serve.mjs      localhost bridge / static serve entrypoint
certs/
  README.md      local HTTPS certificate instructions
```

## Environment

Copy `.env.example` to `.env` and fill in local values.

Key variables:
- `HERMES_API_BASE_URL` — default backend target, usually `http://127.0.0.1:8642`
- `HERMES_API_KEY` — server-side key used by the bridge, never exposed to browser JS
- `HERMES_API_AUTH_HEADER` — auth header injected by the bridge, default `x-api-key`
- `HERMES_API_AUTH_SCHEME` — optional scheme prefix for auth headers, e.g. `Bearer`
- `OFFICE_ADDIN_PASSPHRASE` — local unlock passphrase for the bridge login flow
- `OFFICE_ADDIN_HTTPS_PORT` — default `3446`
- `OFFICE_ADDIN_HTTP_PORT` — default `3300`

## Running Phase 1 locally

```bash
cp .env.example .env
node scripts/serve.mjs
curl http://localhost:3300/health
```

If you want HTTPS for real Office sideloading, add local certs as documented in `certs/README.md`.

## Next build steps

1. bootstrap the pnpm workspace with Vite + React + TypeScript
2. keep the bridge thin and stable
3. port the minimal Hermes chat path first
4. ship Word first
5. then PowerPoint
6. then Outlook
7. leave Excel until the shared core is stable

## License

MIT
