# Roadmap

## Phase 0 - Scaffold
- create clean public repo
- define env contract
- create localhost-first manifest templates
- document bridge architecture and SSH tunneling
- lock public product decisions

## Phase 1 - Thin Hermes bridge
- implement `scripts/serve.mjs`
- add `/health`
- add `/auth/login`
- add `/auth/logout`
- add `/auth/session`
- add `/api/*` proxy with server-side auth injection
- support optional local HTTPS certs
- keep port defaults at `3300` + `3446`

## Phase 2 - Shared frontend foundation
- bootstrap React + TypeScript workspace
- shared shell, login, settings, streaming chat
- shared Hermes API client
- shared save/research primitives
- Mermaid-first visual surface

## Phase 3 - First shippable app
- Word add-in MVP
- prompt -> response -> insert into document
- session persistence
- save/research loop

## Phase 4 - Visual/presentation path
- PowerPoint add-in MVP
- slide chat + insert/refine loop
- Mermaid visual generation
- user template/assets groundwork

## Phase 5 - Mail path
- Outlook read/compose support
- thread-aware session handling
- reply drafting
- research/save flow

## Phase 6 - Spreadsheet path
- Excel MVP
- formula assistant
- selected-range analysis
- lightweight save hooks if genuinely useful
