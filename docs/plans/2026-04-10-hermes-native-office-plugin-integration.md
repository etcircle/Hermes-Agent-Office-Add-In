# Hermes-Native Office Plugin Integration Plan

> For Hermes: use subagent-driven-development to execute this plan task-by-task. Keep the architectural spine in the parent session. Do not let children invent alternative session semantics.

Goal: Replace browser-local Office chat/session behavior with real Hermes-native session continuity, then wire Visuals and STT through existing Hermes infrastructure with minimal backend footprint.

Architecture: The Office add-in stays a thin localhost-authenticated client surface. Hermes remains the source of truth for conversations, session history, image generation, and transcription. The only backend additions allowed are thin API-server surfaces over existing Hermes primitives such as SessionDB, image_generate, and transcribe_audio.

Tech Stack: Hermes API server, SessionDB/state.db, Office add-in bridge, React 19, TypeScript, Vite, existing Hermes image generation and transcription tools.

---

## Non-negotiable product rules

1. Bridge auth session != Hermes conversation session.
2. New chat must create a real Hermes session, not just clear local UI state.
3. Prior sessions must come from Hermes SessionDB-backed history, not localStorage.
4. Office must reuse existing Hermes configuration/runtime for images and STT.
5. No Office-only backend domain model for conversations, media, or transcription.
6. localStorage may remain only as a cache hint for the last-opened Hermes session id and draft input.

---

## Current verified reality

Verified against source on 2026-04-10:

Office repo
- Browser-local session truth currently lives in:
  - packages/shared/src/chat/session-store.ts
  - packages/shared/src/chat/useOfficeChat.ts
- UI sends plain input to `/api/v1/responses` via:
  - packages/shared/src/backend-client.ts
- Bridge is thin auth + proxy, which is good:
  - scripts/serve.mjs

Hermes repo
- Real Hermes sessions live in SessionDB:
  - /Users/felixcardix/.hermes/hermes-agent/hermes_state.py
- API server already supports real session continuity through:
  - /Users/felixcardix/.hermes/hermes-agent/gateway/platforms/api_server.py
  - use `X-Hermes-Session-Id` on `/v1/chat/completions`
- Responses API continuity is separate and not the right primary primitive for Office session browsing:
  - same file, `/v1/responses`, `previous_response_id`, `ResponseStore`
- Existing reusable media/tooling:
  - image generation: /Users/felixcardix/.hermes/hermes-agent/tools/image_generation_tool.py
  - transcription/STT: /Users/felixcardix/.hermes/hermes-agent/tools/transcription_tools.py

Decision:
- Office should standardize on Hermes session continuity via `X-Hermes-Session-Id` over `/v1/chat/completions`.
- Do not build Office around local chat rails or `previous_response_id` chains.

---

## Task 1: Add Hermes-native session browse/create/read APIs to the API server

Objective: Expose thin API-server endpoints backed by existing SessionDB so Office can browse and select real Hermes sessions.

Files:
- Modify: /Users/felixcardix/.hermes/hermes-agent/gateway/platforms/api_server.py
- Inspect/reference: /Users/felixcardix/.hermes/hermes-agent/hermes_state.py
- Inspect/reference: /Users/felixcardix/.hermes/hermes-agent/tests/gateway/test_api_server.py
- Add tests: /Users/felixcardix/.hermes/hermes-agent/tests/gateway/test_api_server.py or a dedicated new test file beside it

Steps:
1. Add failing tests for:
   - `GET /v1/sessions`
   - `GET /v1/sessions/{session_id}`
   - `POST /v1/sessions`
2. Implement thin handlers over existing SessionDB methods:
   - list sessions via `list_sessions_rich(...)`
   - read a session via `get_session(...)` + `get_messages_as_conversation(...)`
   - create a session via `create_session(...)`
3. Return stable minimal payloads:
   - `id`, `title`, `source`, `started_at`, `last_active`, `message_count`, `preview`, optional `parent_session_id`
4. Keep these endpoints Hermes-generic, not Office-branded.
5. Run targeted API server tests.

Verification:
- Hermes repo targeted tests for API server pass.
- Session list endpoint returns existing Hermes sessions from state.db.
- New session endpoint produces a real Hermes session id.

---

## Task 2: Expose `X-Hermes-Session-Id` cleanly for browser clients

Objective: Make browser Office clients able to send and read the real Hermes session header without hacks.

Files:
- Modify: /Users/felixcardix/.hermes/hermes-agent/gateway/platforms/api_server.py
- Test: /Users/felixcardix/.hermes/hermes-agent/tests/gateway/test_api_server.py
- Modify if needed: ~/dev-workspaces/Hermes-Agent-Office-Add-In/scripts/serve.mjs

Steps:
1. Add failing tests for CORS/header behavior if not already covered.
2. Update API server CORS rules to allow request header:
   - `X-Hermes-Session-Id`
3. Expose response header:
   - `X-Hermes-Session-Id`
4. Update `scripts/serve.mjs` so the bridge explicitly forwards `X-Hermes-Session-Id` from upstream responses back to the browser client.
5. Update bridge header handling as needed so `X-Hermes-Session-Id` is not stripped on proxy pass-through.
6. Verify a request with no session header gets a new Hermes session id back from `/v1/chat/completions`.

Verification:
- Browser client can send `X-Hermes-Session-Id` through the bridge.
- Browser client can read the returned header.
- No regressions to existing API server auth behavior.

---

## Task 3: Replace Office local session rails with Hermes-native session state

Objective: Stop treating localStorage transcripts as truth and make the shared Office runtime operate on real Hermes session ids.

Files:
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/shared/src/contracts/capabilities.ts
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/shared/src/backend-client.ts
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/shared/src/chat/useOfficeChat.ts
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/shared/src/chat/session-store.ts
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/shared/src/components/ChatShell.tsx
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/shared/src/index.ts
- Tests:
  - packages/shared/src/__tests__/backend-client.test.ts
  - packages/shared/src/__tests__/chat-shell.test.tsx
  - packages/shared/src/__tests__/session-store.test.ts

Steps:
1. Add failing tests for Hermes-native behavior:
   - `New chat` creates a real Hermes session
   - recent sessions load from backend, not localStorage transcript store
   - selecting a session loads transcript/history from Hermes
   - sending a message continues the same Hermes session via `X-Hermes-Session-Id`
2. Extend shared client capabilities with Hermes-native methods:
   - `listSessions()`
   - `getSession(sessionId)`
   - `createSession()`
   - `sendMessage({ sessionId, input, ... })`
3. Explicitly switch Office send and streaming chat off `/api/v1/responses` and onto `/api/v1/chat/completions`.
4. Carry and read `X-Hermes-Session-Id` as the authoritative Hermes continuity primitive in `backend-client.ts`.
5. Refactor `useOfficeChat` so its source of truth is backend-loaded session data.
6. Reduce `session-store.ts` to cache-only behavior:
   - last-opened session id
   - maybe draft input
   - no canonical transcript storage
7. Update `ChatShell` session rail to render Hermes-backed sessions.

Verification:
- Shared tests pass.
- No localStorage transcript truth remains.
- The only persisted browser state is lightweight cache/hint data.

---

## Task 4: Standardize Word on Hermes-native sessions

Objective: Make Word use the shared Hermes-backed session runtime while keeping bridge auth and host continuity separate.

Files:
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/word/src/App.tsx
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/word/src/App.test.tsx
- Inspect/reference:
  - packages/word/src/word-host.ts
  - packages/word/src/word-host-adapter.ts

Steps:
1. Add failing tests for:
   - login restores bridge auth separately from Hermes session selection
   - `New chat` creates a new Hermes session
   - choosing a previous session rehydrates transcript/history
   - quick actions continue the active Hermes session instead of mutating only local state
2. Remove dependency on `sessionStoreNamespace="word"` as the session identity mechanism.
3. Keep bridge auth bootstrap exactly separate from Hermes chat/session continuity.
4. Preserve Word document actions and quick actions on top of the new session runtime.

Verification:
- Word tests pass.
- Word build passes.
- Refreshing the add-in preserves bridge auth but not fake local transcript state.
- Session selection clearly maps to real Hermes sessions.

---

## Task 5: Add host-context metadata without coupling auth to host identity

Objective: Let Word/Outlook/PowerPoint provide stable host metadata that can guide Hermes continuity, without inventing host-owned session semantics.

Files:
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/shared/src/contracts/host-adapter.ts
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/word/src/word-host-adapter.ts
- Future follow-ons:
  - packages/outlook/src/... real host adapter
  - packages/powerpoint/src/... real host adapter

Steps:
1. Add a lightweight host metadata contract, for example:
   - host type
   - document/deck/thread identifier if available
   - title/name
   - optional selection/context summary
2. Pass host metadata with chat requests as context metadata, not as the session id itself.
3. Do not auto-force one document = one session. Keep `New chat` authoritative.
4. Use metadata to support smarter “related sessions” suggestions later.

Verification:
- Word host adapter can provide metadata without affecting bridge auth behavior.
- No code couples session validity to document switching.

---

## Task 6: Wire Visuals through existing Hermes image generation

Objective: Make the Visuals workspace use existing Hermes image generation rather than adding a separate Office image pipeline.

Files:
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/shared/src/contracts/capabilities.ts
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/shared/src/backend-client.ts
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/shared/src/app/OfficeAppShell.tsx or a dedicated shared Visuals component
- Add/modify tests in packages/shared/src/__tests__/
- Hermes reference only:
  - /Users/felixcardix/.hermes/hermes-agent/tools/image_generation_tool.py

Preferred first implementation:
- Route Visuals through the existing Hermes chat/tool execution path inside the active Hermes session.
- Only add a dedicated thin API-server wrapper later if the UX truly needs structured non-chat calls.

Steps:
1. Replace the Visuals placeholder with a shared component.
2. Add prompt/action flow that triggers existing Hermes image generation capability.
3. Render returned image URLs/artifacts in the Visuals panel.
4. Keep generated visuals associated with the active Hermes session.

Verification:
- No Office-only image backend is introduced.
- Visual generation uses existing Hermes infra and config.
- Result appears in-session and in the Visuals panel.

---

## Task 7: Wire STT through existing Hermes transcription infrastructure

Objective: Reuse Hermes transcription/STT config and implementation for Office audio input.

Files:
- Hermes thin API addition if needed:
  - /Users/felixcardix/.hermes/hermes-agent/gateway/platforms/api_server.py
- Hermes reference:
  - /Users/felixcardix/.hermes/hermes-agent/tools/transcription_tools.py
- Office shared client/UI:
  - ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/shared/src/contracts/capabilities.ts
  - ~/dev-workspaces/Hermes-Agent-Office-Add-In/packages/shared/src/backend-client.ts
  - shared workspace UI file(s)

Preferred implementation:
- If Office needs direct microphone/file transcription UX, add only a thin API-server endpoint that calls `transcribe_audio(...)`.
- Do not add a second STT configuration system.

Steps:
1. Add failing API-server test for a thin transcription endpoint if direct upload UX is needed.
2. Implement endpoint as a wrapper over `transcribe_audio(...)`.
3. Add Office shared client method for transcription.
4. Feed transcript back into the active Hermes session/workspace.

Verification:
- STT uses Hermes config/provider selection.
- No Office-specific STT provider settings are introduced.

---

## Task 8: Update docs and kill misleading local-session language

Objective: Make the docs reflect the real plugin architecture and remove wording that implies Office owns conversation truth.

Files:
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/README.md
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/docs/ARCHITECTURE.md
- Modify: ~/dev-workspaces/Hermes-Agent-Office-Add-In/docs/ROADMAP.md

Steps:
1. Document the distinction:
   - bridge auth session
   - Hermes conversation/session
2. Document the chosen continuity primitive:
   - `/v1/chat/completions` + `X-Hermes-Session-Id`
3. Document that Visuals and STT are Hermes-powered plugin surfaces.
4. Explicitly mark browser-local session storage as cache-only if it remains.

Verification:
- Docs match the implemented architecture.
- No doc claims that Office has its own conversation backend.

---

## Execution order

Do this in order:
1. Task 1 — session browse/create APIs
2. Task 2 — header/CORS exposure
3. Task 3 — shared runtime refactor
4. Task 4 — Word migration
5. Task 5 — host metadata contract
6. Task 6 — Visuals wiring
7. Task 7 — STT wiring
8. Task 8 — docs cleanup

Do not start Visuals/STT before Tasks 1-4 are done. That would be architecture cosplay.

---

## Anti-patterns to reject immediately

- Keeping localStorage transcript rails as a second source of truth
- Using `/v1/responses` + `previous_response_id` as the primary Office session model
- Creating an Office-only conversation database or service
- Adding Office-specific image or STT provider config
- Coupling host/document identity to auth session validity
- Letting subagents modify both Hermes core session semantics and Office runtime semantics in parallel without parent reconciliation

---

## Minimum verification checklist

Hermes repo
- targeted API server tests pass
- session browse/create endpoints return real SessionDB-backed data
- `X-Hermes-Session-Id` works end-to-end from browser-compatible requests

Office repo
- `pnpm test`
- `pnpm --filter @hermes-agent-office/word build`
- `node --check scripts/serve.mjs`
- browser smoke:
  - login once
  - create new chat -> new Hermes session id
  - select older session -> transcript restored from Hermes
  - send another message -> same Hermes session continues
  - Visuals uses Hermes image generation path
  - STT uses Hermes transcription path when implemented

---

## Final verdict

The current local session rail should be treated as scaffolding and replaced, not evolved into the final system. The right spine is already in Hermes; Office just needs to stop pretending to be its own chat product.