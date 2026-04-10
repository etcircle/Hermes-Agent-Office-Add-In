# Hermes Office Shared Platform Implementation Plan

> For Hermes: use subagent-driven-development to execute this plan chunk-by-chunk. Do not freestyle architecture in the middle of implementation.

Goal: turn the current Word-first prototype into a real shared Office platform for Word, PowerPoint, and Outlook, with Research, Visuals, Assets/Templates, and Branding built as shared capabilities instead of host-specific hacks.

Architecture: keep the localhost bridge thin, keep auth and backend secrets server-side, build one shared frontend Office runtime in `packages/shared`, and hang thin host adapters off it for Word, PowerPoint, and Outlook. Word remains the reference host, but it must stop being the accidental architecture.

Tech stack: pnpm workspace, React, TypeScript, Vite, Vitest, Office.js, thin Node bridge in `scripts/serve.mjs`.

---

## Why this plan exists

The repo is already beyond scaffolding:
- bridge/auth works
- shared login + chat shell exists
- Word can read selection, generate responses, and apply results back into the document

That is enough proof-of-life.

It is not enough architecture.

If we keep bolting features straight into `packages/word/src/App.tsx`, we will end up with three different mini-products pretending to be one Office platform. That would be dumb, fragile, and expensive.

The DI-Copilot research already gave us the right answer:
- one shared Office runtime
- thin host adapters
- sidecar/workspace model for research and visuals
- structured apply loops back into the host

This plan turns that into an execution path.

---

## Current baseline in this repo

Already implemented:
- `scripts/serve.mjs`
- `packages/shared/src/auth.ts`
- `packages/shared/src/backend-client.ts`
- `packages/shared/src/components/LoginPage.tsx`
- `packages/shared/src/components/ChatShell.tsx`
- `packages/word/src/App.tsx`
- `packages/word/src/word-host.ts`

Current gaps:
- no startup session revalidation through `/auth/session`
- no proper bridge logout through `/auth/logout`
- no shared app shell / panel router
- no streaming runtime
- no recent sessions model
- no shared Research workspace
- no shared Mermaid-first Visuals workspace
- no shared Assets/Templates workspace
- no shared Theme/Brand contract
- no real PowerPoint app
- no real Outlook app

---

## Product rules this plan must respect

1. Native Hermes only.
2. Localhost-first manifests stay the default.
3. Browser never owns long-lived Hermes API credentials.
4. Mermaid is the default visual grammar.
5. `openclaw-office` and DI-Copilot are references, not code donors.
6. Word remains the execution reference host.
7. Public release order remains:
   - Word
   - PowerPoint
   - Outlook
   - Excel later
8. Internal architecture work may land shared runtime pieces before the next host ships. That is not a contradiction; that is how we avoid a pile of duplicated garbage.

---

## Target architecture

## Layer 1 - Bridge

Owns:
- local passphrase login
- short-lived bridge session
- `/auth/session` validation
- `/auth/logout`
- `/api/*` proxy to Hermes backend
- static app serving for each host app

Must stay thin.

## Layer 2 - Shared Office runtime (`packages/shared`)

Owns:
- auth/session bootstrap
- chat runtime
- streaming state
- recent sessions
- panel routing
- shared response rendering
- shared workspace entrypoints
- shared backend capability client

## Layer 3 - Host adapters

Owns only host-specific behavior:
- host availability
- host identity/session key derivation
- host context extraction
- host-native apply actions
- host-native quick actions
- host-native preview semantics

## Layer 4 - Shared workspaces

These are shared, not per-host:
- Research
- Visuals
- Assets
- Templates
- Themes/Brand kits

## Layer 5 - Host-specific products on shared rails

- Word: authoring, rewrite/expand/summarise, insert/replace, document-aware generation
- PowerPoint: structured deck generation, preview, insert/download, fill-current-slide, theme-aware generation
- Outlook: thread-aware drafting, summarise/reply, compose help, attachment-aware flows

---

## Proposed file seams

Create or evolve the architecture around these seams.

Shared runtime:
- Create: `packages/shared/src/contracts/host-adapter.ts`
- Create: `packages/shared/src/contracts/capabilities.ts`
- Create: `packages/shared/src/app/OfficeAppShell.tsx`
- Create: `packages/shared/src/app/WorkspaceTabs.tsx`
- Create: `packages/shared/src/chat/useOfficeChat.ts`
- Create: `packages/shared/src/chat/useStreamingResponse.ts`
- Create: `packages/shared/src/session/session-store.ts`
- Create: `packages/shared/src/session/recent-sessions.ts`
- Create: `packages/shared/src/research/ResearchWorkspace.tsx`
- Create: `packages/shared/src/visuals/VisualWorkspace.tsx`
- Create: `packages/shared/src/assets/AssetsWorkspace.tsx`
- Create: `packages/shared/src/assets/types.ts`
- Create: `packages/shared/src/themes/theme-types.ts`
- Modify: `packages/shared/src/backend-client.ts`
- Modify: `packages/shared/src/auth.ts`
- Modify: `packages/shared/src/components/LoginPage.tsx`
- Modify: `packages/shared/src/components/ChatShell.tsx`
- Modify: `packages/shared/src/index.ts`

Word:
- Modify: `packages/word/src/App.tsx`
- Modify: `packages/word/src/word-host.ts`
- Create: `packages/word/src/word-host-adapter.ts`
- Create: `packages/word/src/word-quick-actions.ts`

PowerPoint:
- Create: `packages/powerpoint/src/main.tsx`
- Create: `packages/powerpoint/src/App.tsx`
- Create: `packages/powerpoint/src/powerpoint-host.ts`
- Create: `packages/powerpoint/src/powerpoint-quick-actions.ts`
- Create: `packages/powerpoint/src/styles.css`
- Create: `packages/powerpoint/src/test-setup.ts`
- Create: `packages/powerpoint/src/App.test.tsx`

Outlook:
- Create: `packages/outlook/src/main.tsx`
- Create: `packages/outlook/src/App.tsx`
- Create: `packages/outlook/src/outlook-host.ts`
- Create: `packages/outlook/src/outlook-session.ts`
- Create: `packages/outlook/src/styles.css`
- Create: `packages/outlook/src/test-setup.ts`
- Create: `packages/outlook/src/App.test.tsx`

Bridge/docs:
- Modify: `scripts/serve.mjs`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ROADMAP.md` when shared-platform phases become real, not just aspirational

---

## Capability contracts

These contracts should exist before more host work.

### `HostAdapter`

The shared runtime should depend on a narrow interface, roughly like this:

```ts
export interface HostAdapter<THostContext = unknown, THostAction = unknown> {
  hostName: 'word' | 'powerpoint' | 'outlook';
  getAvailability(): { available: boolean; reason?: string };
  getSessionIdentity(): Promise<{ key: string; label?: string }>;
  getContext(): Promise<THostContext>;
  getQuickActions?(): THostAction[];
  applyResponse?(response: string, actionId: string): Promise<void>;
}
```

### `Backend capabilities`

Do not let `HermesBackendClient` become a god-object. Split the contract logically even if one composed client instance wraps it:

```ts
export interface SessionCapability {
  getSession(): Promise<{ authenticated: boolean; expiresAt?: string }>;
  logout(): Promise<void>;
}

export interface ChatCapability {
  chat(input: string): Promise<ChatResponse>;
  stream?(input: string, onChunk: (chunk: string) => void): Promise<ChatResponse>;
}

export interface ResearchCapability {
  search(query: string, scope: 'web' | 'local' | 'both'): Promise<ResearchResult[]>;
}

export interface AssetCapability {
  listAssets(kind?: string): Promise<OfficeAsset[]>;
  saveAsset(input: SaveAssetInput): Promise<OfficeAsset>;
}
```

The point is not type purity. The point is keeping the architecture from rotting.

---

## Delivery model

This plan is split into 9 chunks so each chunk can be delegated cleanly to an agent without blowing context.

Each chunk should end with:
- tests green
- build green where applicable
- docs updated
- clean commit

---

## Chunk 1 - Shared platform contract cleanup

Objective: stop treating Word’s current app structure as the platform contract.

Files:
- Create: `packages/shared/src/contracts/host-adapter.ts`
- Create: `packages/shared/src/contracts/capabilities.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/word/src/App.tsx`

Work:
1. Define `HostAdapter` and basic capability types.
2. Move Word-specific quick-action typing out of generic shared UI concerns.
3. Make `ChatShell` and future shared shell accept host-driven actions through explicit contracts, not Word-flavoured props.
4. Export the new shared contracts.

Verification:
- `pnpm --filter @hermes-agent-office/shared test`
- `pnpm --filter @hermes-agent-office/word test`

Exit criteria:
- shared package exposes host/platform contracts
- Word still works unchanged from a user perspective

Suggested commit:
- `refactor: formalize shared office platform contracts`

---

## Chunk 2 - Bridge auth/session hardening

Objective: make the frontend trust the bridge session lifecycle instead of blindly trusting localStorage.

Files:
- Modify: `scripts/serve.mjs`
- Modify: `packages/shared/src/backend-client.ts`
- Modify: `packages/shared/src/auth.ts`
- Modify: `packages/shared/src/components/LoginPage.tsx`
- Modify: `packages/word/src/App.tsx`
- Test: `packages/shared/src/__tests__/backend-client.test.ts`
- Test: `packages/shared/src/__tests__/auth.test.ts`
- Test: `packages/shared/src/__tests__/login-page.test.tsx`

Work:
1. Add frontend methods for:
   - `getBridgeSession()`
   - `logout()`
2. On startup, revalidate the stored session token through `/auth/session`.
3. On logout, call `/auth/logout` before clearing local state.
4. Make `LoginPage` host-neutral. “Unlock Word” in shared UI is sloppy.
5. Keep localStorage as a cache hint, not the source of truth.

Verification:
- `pnpm --filter @hermes-agent-office/shared test`
- `node --check scripts/serve.mjs`

Exit criteria:
- page reload does not trust stale token blindly
- logout actually kills the bridge session
- shared login copy is no longer Word-specific

Suggested commit:
- `feat: harden bridge session lifecycle`

---

## Chunk 3 - Shared Office app shell and panel router

Objective: introduce the shared runtime shell before adding Research/Visuals/Assets.

Files:
- Create: `packages/shared/src/app/OfficeAppShell.tsx`
- Create: `packages/shared/src/app/WorkspaceTabs.tsx`
- Modify: `packages/shared/src/components/ChatShell.tsx`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/word/src/App.tsx`
- Test: `packages/shared/src/__tests__/chat-shell.test.tsx`
- Create: `packages/shared/src/__tests__/office-app-shell.test.tsx`

Work:
1. Split the current one-card shell into:
   - app shell
   - chat workspace
   - extra workspace tabs
2. Keep the initial tabs simple:
   - Chat
   - Research
   - Visuals
   - Assets
3. Tabs may be disabled/placeholder until their chunks land, but the routing shell must exist first.
4. Recompose Word on top of `OfficeAppShell`.

Verification:
- `pnpm --filter @hermes-agent-office/shared test`
- `pnpm --filter @hermes-agent-office/word test`
- `pnpm --filter @hermes-agent-office/word build`

Exit criteria:
- Word runs on the shared shell
- workspace navigation exists
- no Research/Visuals/Assets logic is hardcoded into Word app composition

Suggested commit:
- `feat: add shared office app shell`

---

## Chunk 4 - Session model and streaming chat runtime

Objective: build the shared conversation spine before second-host work begins.

Files:
- Create: `packages/shared/src/chat/useOfficeChat.ts`
- Create: `packages/shared/src/chat/useStreamingResponse.ts`
- Create: `packages/shared/src/session/session-store.ts`
- Create: `packages/shared/src/session/recent-sessions.ts`
- Modify: `packages/shared/src/backend-client.ts`
- Modify: `packages/shared/src/components/ChatShell.tsx`
- Create: `packages/shared/src/__tests__/session-store.test.ts`
- Create: `packages/shared/src/__tests__/streaming-response.test.ts`

Work:
1. Move message/response/loading/error state into hooks.
2. Add recent-session storage model in shared.
3. Add bridge/client support for future streaming responses.
4. Keep the non-streaming path working; do not break the current backend contract just to feel clever.
5. Make host identity pluggable so Word, PowerPoint, and Outlook can each derive their own session key cleanly.

Verification:
- `pnpm --filter @hermes-agent-office/shared test`
- `pnpm --filter @hermes-agent-office/word test`

Exit criteria:
- shared chat state is hook-based
- recent sessions are possible at shared layer
- Word composes shared chat runtime instead of owning chat state locally

Suggested commit:
- `feat: add shared office chat and session runtime`

---

## Chunk 5 - Research workspace MVP

Objective: ship the first real shared sidecar.

Files:
- Create: `packages/shared/src/research/ResearchWorkspace.tsx`
- Create: `packages/shared/src/research/types.ts`
- Modify: `packages/shared/src/backend-client.ts`
- Modify: `packages/shared/src/app/OfficeAppShell.tsx`
- Create: `packages/shared/src/__tests__/research-workspace.test.tsx`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`

Work:
1. Add a host-neutral Research workspace with:
   - query input
   - scope selector (`web`, `local`, `both`)
   - results list
   - pin/unpin affordance
   - “use in chat” handoff
2. Keep backend wiring thin and explicit; if Hermes does not yet expose a perfect search endpoint, stub the client contract cleanly rather than hiding fetch spaghetti in the component.
3. Keep saved research sessions deliberately minimal for MVP.

Verification:
- `pnpm --filter @hermes-agent-office/shared test`
- `pnpm --filter @hermes-agent-office/word build`

Exit criteria:
- Research exists in shared runtime
- Word can open it without custom Word-only composition
- pinned findings can be injected back into chat

Suggested commit:
- `feat: add shared research workspace`

---

## Chunk 6 - Mermaid-first Visuals workspace MVP

Objective: ship the second shared sidecar and keep the public baseline clean.

Files:
- Create: `packages/shared/src/visuals/VisualWorkspace.tsx`
- Create: `packages/shared/src/visuals/mermaid.ts`
- Create: `packages/shared/src/visuals/types.ts`
- Modify: `packages/shared/src/backend-client.ts`
- Modify: `packages/shared/src/app/OfficeAppShell.tsx`
- Create: `packages/shared/src/__tests__/visual-workspace.test.tsx`

Work:
1. Build Visuals around Mermaid first:
   - prompt -> Mermaid text
   - Mermaid preview
   - edit/refine loop
   - save as asset
2. Add optional host callback seam for image insertion later.
3. Do not resurrect draw.io in the public baseline. That way lies product sludge.

Verification:
- `pnpm --filter @hermes-agent-office/shared test`
- `pnpm --filter @hermes-agent-office/word build`

Exit criteria:
- Mermaid visuals are shared across hosts
- saved diagram asset contract exists
- nothing in the shared visuals layer assumes PowerPoint or Word specifically

Suggested commit:
- `feat: add mermaid-first visuals workspace`

---

## Chunk 7 - Shared Assets/Templates/Themes foundation

Objective: define the reusable content layer before PowerPoint gets fancy and before Word gains template debt.

Files:
- Create: `packages/shared/src/assets/AssetsWorkspace.tsx`
- Create: `packages/shared/src/assets/types.ts`
- Create: `packages/shared/src/themes/theme-types.ts`
- Modify: `packages/shared/src/backend-client.ts`
- Modify: `packages/shared/src/app/OfficeAppShell.tsx`
- Create: `packages/shared/src/__tests__/assets-workspace.test.tsx`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ROADMAP.md`

Work:
1. Define shared types for:
   - `OfficeAsset`
   - `OfficeTemplate`
   - `BrandTheme`
2. Build a simple Assets workspace with:
   - list
   - inspect
   - save current output as asset
3. Keep template/theme application logic out of the UI for now; define the contract first.
4. Separate asset kinds cleanly:
   - research-note
   - mermaid-diagram
   - word-template
   - powerpoint-template
   - brand-theme

Verification:
- `pnpm --filter @hermes-agent-office/shared test`
- `pnpm --filter @hermes-agent-office/word build`

Exit criteria:
- shared asset and theme contracts exist
- shared UI can list and save assets in a host-neutral way
- PowerPoint and Word can later consume the same asset registry

Suggested commit:
- `feat: add shared assets and theme contracts`

---

## Chunk 8 - Word reference-host refactor on shared rails

Objective: keep Word useful while moving it onto the platform properly.

Files:
- Modify: `packages/word/src/App.tsx`
- Modify: `packages/word/src/word-host.ts`
- Create: `packages/word/src/word-host-adapter.ts`
- Create: `packages/word/src/word-quick-actions.ts`
- Modify: `packages/word/src/App.test.tsx`
- Modify: `packages/word/src/word-host.test.ts`

Work:
1. Split Word into:
   - host adapter
   - quick-action definitions
   - app composition
2. Keep current actions:
   - rewrite
   - expand
   - summarise
   - insert
   - replace
3. Add hooks for shared assets/research/visuals consumption.
4. If document context expansion is added, do it through the Word adapter, not by dumping more crap into shared chat UI.

Verification:
- `pnpm --filter @hermes-agent-office/word test`
- `pnpm --filter @hermes-agent-office/word build`
- `pnpm --filter @hermes-agent-office/shared test`

Exit criteria:
- Word is cleanly composed from shared shell + Word adapter
- no Word-specific copy leaks in shared UI
- Word remains the reference host for future adapters

Suggested commit:
- `refactor: move word onto shared office runtime`

---

## Chunk 9 - PowerPoint and Outlook adapters

Objective: bring the second and third hosts onto the same architecture without inventing new product shapes.

Files:
- Create: `packages/powerpoint/src/main.tsx`
- Create: `packages/powerpoint/src/App.tsx`
- Create: `packages/powerpoint/src/powerpoint-host.ts`
- Create: `packages/powerpoint/src/powerpoint-quick-actions.ts`
- Create: `packages/powerpoint/src/styles.css`
- Create: `packages/powerpoint/src/test-setup.ts`
- Create: `packages/powerpoint/src/App.test.tsx`
- Create: `packages/outlook/src/main.tsx`
- Create: `packages/outlook/src/App.tsx`
- Create: `packages/outlook/src/outlook-host.ts`
- Create: `packages/outlook/src/outlook-session.ts`
- Create: `packages/outlook/src/styles.css`
- Create: `packages/outlook/src/test-setup.ts`
- Create: `packages/outlook/src/App.test.tsx`

Work:
1. PowerPoint first for product release order:
   - shared shell
   - deck context adapter
   - generate deck prompt path
   - preview-first placeholder if full insert path is not done yet
   - fill-slide seam defined even if MVP is partial
2. Outlook next:
   - compose/read context
   - thread-aware session identity
   - summarise/reply flows
3. Reuse shared Research/Visuals/Assets tabs in both.
4. Do not let either host bypass shared runtime patterns.

Verification:
- `pnpm --filter @hermes-agent-office/powerpoint test`
- `pnpm --filter @hermes-agent-office/powerpoint build`
- `pnpm --filter @hermes-agent-office/outlook test`
- `pnpm --filter @hermes-agent-office/outlook build`
- `pnpm --filter @hermes-agent-office/shared test`
- `node --check scripts/serve.mjs`

Exit criteria:
- PowerPoint and Outlook are real apps, not manifest placeholders
- both use shared shell/workspaces
- both define host-specific identity/context/apply seams cleanly

Suggested commit sequence:
- `feat: add powerpoint shared-runtime host`
- `feat: add outlook shared-runtime host`

---

## Capability matrix to enforce during implementation

| Capability | Shared | Word | PowerPoint | Outlook |
|---|---|---|---|---|
| Auth/session bootstrap | yes | consume | consume | consume |
| Chat runtime | yes | consume | consume | consume |
| Recent sessions | yes | host identity source | host identity source | host identity source |
| Research workspace | yes | consume | consume | consume |
| Visuals workspace | yes | consume | consume | consume |
| Assets/Templates workspace | yes | consume | consume | consume |
| Theme/Brand contract | yes | apply styles | apply layouts/theme | mostly consume |
| Host context extraction | no | yes | yes | yes |
| Host-native apply actions | no | yes | yes | yes |
| Selection/current-item awareness | no | yes | yes | yes |

If a future change violates this split, stop and fix it instead of rationalizing it.

---

## Known risks

1. `HermesBackendClient` will try to become a junk drawer if left unsupervised.
2. Word success will tempt us to keep cheating in `packages/word/src/App.tsx`.
3. PowerPoint can explode into template complexity too early.
4. Outlook will punish any lazy session identity model.
5. Shared UI copy will stay Word-shaped unless corrected deliberately.

---

## Non-goals for this plan

Not now:
- Excel parity
- Draw.io baseline support
- enterprise scope/RBAC complexity copied from DI-Copilot
- risky PowerPoint reuse/overwrite defaults
- heavyweight asset governance UX
- perfect backend contracts before the shared frontend seams exist

---

## Verification checklist for every chunk

Run the smallest relevant verification first, then the broader one.

Baseline commands:
```bash
pnpm --filter @hermes-agent-office/shared test
pnpm --filter @hermes-agent-office/word test
pnpm --filter @hermes-agent-office/word build
node --check scripts/serve.mjs
```

When PowerPoint and Outlook land, add:
```bash
pnpm --filter @hermes-agent-office/powerpoint test
pnpm --filter @hermes-agent-office/powerpoint build
pnpm --filter @hermes-agent-office/outlook test
pnpm --filter @hermes-agent-office/outlook build
```

Bridge smoke check after bridge-affecting changes:
```bash
node scripts/serve.mjs
curl http://localhost:3300/health
```

---

## Recommended execution order

Actual execution order:
1. Chunk 1
2. Chunk 2
3. Chunk 3
4. Chunk 4
5. Chunk 5
6. Chunk 6
7. Chunk 7
8. Chunk 8
9. Chunk 9

That order is deliberate:
- contracts first
- session correctness second
- shared shell third
- shared runtime fourth
- shared sidecars before second/third hosts
- Word refactor after the platform exists
- PowerPoint and Outlook last, on shared rails

That is the sane path.
