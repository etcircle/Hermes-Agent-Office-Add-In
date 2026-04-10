# Phase 1 Hermes Office Bridge Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Ship a working localhost bridge for the public Hermes Office add-in repo with health checks, passphrase login, session state, and backend proxying.

**Architecture:** Use a thin Node 20 bridge with no framework. Keep state in memory for Phase 1, expose stable auth/health endpoints, and proxy `/api/*` to the Hermes backend with server-side auth injection.

**Tech Stack:** Node 20 built-ins (`http`, `https`, `fs`, `crypto`, `url`), plain JSON APIs, localhost-first Office manifests.

---

### Task 1: Lock product decisions into docs

**Objective:** Make the public repo direction explicit before code grows the wrong shape.

**Files:**
- Create: `docs/PRODUCT-DECISIONS.md`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ROADMAP.md`

**Verification:**
- Docs mention native Hermes identity
- HTTPS default is `3446`
- Mermaid-only default is documented
- assets/templates + research/save directions are captured

### Task 2: Replace scaffold bridge with a real Phase 1 server

**Objective:** Turn `scripts/serve.mjs` from placeholder text into a usable bridge.

**Files:**
- Modify: `scripts/serve.mjs`
- Modify: `.env.example`

**Endpoints:**
- `GET /health`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/session`
- `ANY /api/*`

**Verification:**
- `curl http://localhost:3300/health` returns JSON
- login returns a token on valid passphrase
- `/auth/session` reflects token validity
- `/api/*` requires authentication and strips `/api` before upstream forwarding

### Task 3: Align manifests and shared constants

**Objective:** Ensure repo defaults match the chosen runtime contract.

**Files:**
- Modify: `packages/shared/src/product.ts`
- Modify: `packages/word/public/manifest.xml`
- Modify: `packages/powerpoint/public/manifest.xml`
- Modify: `packages/excel/public/manifest.xml`
- Modify: `packages/outlook/public/manifest.xml`

**Verification:**
- all manifests point to `https://localhost:3446`
- shared defaults also use `3446`

### Task 4: Add HTTPS setup guidance

**Objective:** Make the repo usable for real Office sideloading without baking certs into git.

**Files:**
- Create: `certs/README.md`
- Modify: `.gitignore`

**Verification:**
- cert/key paths are documented
- local cert files are ignored from git

### Task 5: Verify locally and commit

**Objective:** Prove Phase 1 actually works instead of just looking tidy in git.

**Commands:**
- `node scripts/serve.mjs`
- `curl http://localhost:3300/health`
- `curl -X POST http://localhost:3300/auth/login -H 'content-type: application/json' -d '{"passphrase":"..."}'`
- `git add . && git commit -m "feat: implement phase 1 office bridge"`

**Verification:**
- health endpoint returns expected config snapshot
- login/session/logout cycle works
- repo is committed and pushed cleanly
