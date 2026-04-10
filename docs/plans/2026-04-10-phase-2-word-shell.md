# Phase 2 Shared Workspace + Word Shell Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Bootstrap the first real frontend in `Hermes-Agent-Office-Add-In`: a shared React/Vite workspace plus a working Word app shell that logs into the local bridge, persists session state, and sends chat requests through `/api/v1/responses`.

**Architecture:** Keep the frontend thin and generic. Put auth/session handling, bridge client calls, and base UI primitives in `packages/shared`, then keep `packages/word` as a small host-specific shell. Do not drag in PowerPoint/Outlook complexity yet.

**Tech Stack:** pnpm workspaces, Vite, React 19, TypeScript, Vitest, jsdom.

---

### Task 1: Define workspace package shape

**Objective:** Add the minimum package and build structure needed for a real frontend without pretending the whole suite is done.

**Files:**
- Modify: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/word/tsconfig.json`
- Create: `packages/word/vite.config.ts`
- Create: `packages/shared/src/index.ts`

**Verification:**
- `pnpm install` succeeds
- `pnpm --filter @hermes-agent-office/word build` can run once code exists

### Task 2: Write failing tests for shared auth and backend client

**Objective:** Lock the core frontend behavior before writing the implementation.

**Files:**
- Create: `packages/shared/src/__tests__/auth.test.ts`
- Create: `packages/shared/src/__tests__/backend-client.test.ts`

**Behaviors to test:**
- session token can be stored, read, and cleared
- auth headers include `X-Session-Token` when present
- bridge client calls `/auth/login`
- chat call posts to `/api/v1/responses`
- missing token does not inject fake auth

**Verification:**
- tests fail first for the expected reason

### Task 3: Implement shared frontend primitives

**Objective:** Make `packages/shared` the real reusable frontend spine.

**Files:**
- Modify: `packages/shared/package.json`
- Modify: `packages/shared/src/auth.ts`
- Modify: `packages/shared/src/backend-client.ts`
- Create: `packages/shared/src/components/LoginPage.tsx`
- Create: `packages/shared/src/components/ChatShell.tsx`
- Create: `packages/shared/src/styles.css`
- Modify: `packages/shared/src/index.ts`

**Verification:**
- shared tests pass
- no app-specific branding leaks into shared UI

### Task 4: Build the Word app shell

**Objective:** Turn `packages/word` into the first shippable frontend host.

**Files:**
- Modify: `packages/word/package.json`
- Create: `packages/word/index.html`
- Create: `packages/word/src/main.tsx`
- Create: `packages/word/src/App.tsx`
- Create: `packages/word/src/styles.css`

**Behavior:**
- renders a Hermes Word shell
- shows login form until bridge session exists
- logs in with passphrase
- displays simple chat UI after login
- sends prompt to bridge and renders response text

**Verification:**
- local build succeeds
- generated app can load in browser and talk to the bridge

### Task 5: Teach the bridge to serve built frontend assets

**Objective:** Make `scripts/serve.mjs` serve the Word build instead of a placeholder page when a dist exists.

**Files:**
- Modify: `scripts/serve.mjs`

**Behavior:**
- serve `packages/word/dist/index.html` for `/word/`
- serve built assets under `/word/assets/*`
- keep placeholder fallback if not built yet

**Verification:**
- build Word
- start bridge
- `http://localhost:3300/word/` returns built app HTML

### Task 6: Verify end to end and commit

**Objective:** Prove the first real frontend loop works.

**Commands:**
- `pnpm install`
- `pnpm --filter @hermes-agent-office/shared test`
- `pnpm --filter @hermes-agent-office/word build`
- `OFFICE_ADDIN_PASSPHRASE=... HERMES_API_KEY=... node scripts/serve.mjs`
- browser/curl verification against `/word/`, `/auth/login`, `/auth/session`

**Verification:**
- tests pass
- Word build passes
- bridge serves the built Word shell
- login + chat flow works against the bridge
