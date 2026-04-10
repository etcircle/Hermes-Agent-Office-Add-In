# Hermes-Agent-Office-Add-In

Public Microsoft Office add-ins for Hermes Agent.

This repo is the clean public successor to the internal OpenClaw/Hermes Office experiments. The goal is brutally simple: make Word, PowerPoint, Excel, and Outlook add-ins easy to run locally, easy to sideload, and easy to connect to a Hermes backend without shoving secrets into the browser.

## Current status

Scaffolded repository with:
- workspace layout for shared code + app-specific add-ins
- localhost-first manifest templates for Word, PowerPoint, Excel, and Outlook
- architecture docs for backend/gateway integration
- SSH tunneling guidance for remote Hermes deployments
- public-safe env contract for the local bridge server

## Recommended architecture

Do not clone `openclaw-office` blindly. That codebase has useful patterns, but it also carries product drift, stale docs, DI/OpenClaw naming ghosts, and auth assumptions that do not belong in a public Hermes repo.

The right shape is:
1. Office add-in frontend in this repo
2. thin local bridge server on `https://localhost:3445`
3. Hermes API / gateway behind that bridge on `http://127.0.0.1:8642` by default
4. browser never sees long-lived backend secrets
5. manifests default to localhost, with tunneling as an optional dev convenience

See `docs/ARCHITECTURE.md` and `docs/SSH-TUNNELING.md`.

## Planned apps

- Outlook: email assistance, thread context, draft/reply workflows
- Word: authoring, rewriting, insertion, document-aware chat
- PowerPoint: deck generation, slide refinement, visual insertions
- Excel: formula help, analysis, planning, table/chart actions

## Repo layout

```text
packages/
  shared/        shared types, auth, client, UI primitives
  word/          Word add-in
  powerpoint/    PowerPoint add-in
  excel/         Excel add-in
  outlook/       Outlook add-in
scripts/
  serve.mjs      localhost bridge / static serve entrypoint (planned)
docs/
  ARCHITECTURE.md
  SSH-TUNNELING.md
  ROADMAP.md
```

## Environment

Copy `.env.example` to `.env` and fill in local values.

Key variables:
- `HERMES_API_BASE_URL` — default backend target, usually `http://127.0.0.1:8642`
- `HERMES_API_KEY` — server-side key used by the bridge, never exposed to browser JS
- `OFFICE_ADDIN_PASSPHRASE` — optional local unlock passphrase for the bridge login flow
- `OFFICE_ADDIN_HTTPS_PORT` — default `3445`
- `OFFICE_ADDIN_HTTP_PORT` — default `3300`

## Next build steps

1. bootstrap pnpm workspace packages with Vite + React + TypeScript
2. implement shared auth/session module
3. implement bridge server with `/auth/login`, `/health`, and `/api/*` proxy
4. port the minimal Hermes chat path first
5. then land app-specific Office host integrations one by one

## License

MIT
