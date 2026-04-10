# Roadmap

## Phase 0 - Scaffold
- create clean public repo
- define env contract
- create localhost-first manifest templates
- document bridge architecture and SSH tunneling

## Phase 1 - Thin Hermes bridge
- implement `scripts/serve.mjs`
- add `/health`
- add `/auth/login`
- add `/api/v1/responses` proxy
- support local HTTPS certs

## Phase 2 - Shared frontend foundation
- bootstrap React + TypeScript workspace
- shared shell, login, settings, streaming chat
- shared Hermes API client

## Phase 3 - First shippable app
- Word add-in MVP
- prompt -> response -> insert into document
- session persistence

## Phase 4 - Visual/presentation path
- PowerPoint add-in MVP
- slide chat + insert/refine loop

## Phase 5 - Mail path
- Outlook read/compose support
- thread-aware session handling
- reply drafting

## Phase 6 - Spreadsheet path
- Excel MVP
- formula assistant
- selected-range analysis
