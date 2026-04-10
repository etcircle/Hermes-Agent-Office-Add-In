# Hermes Agent Office Platform Direction

Date: 2026-04-10
Status: Draft
Source: CGC + live code research across DI-Copilot Office add-ins (`di-copilot/extensions/office`) excluding Excel

## Why this spec exists

We need to stop building Hermes Agent Office add-ins as isolated one-off surfaces.

The DI-Copilot Office work already proved the right bigger-picture shape:
- one shared Office runtime
- thin host adapters for Word / Outlook / PowerPoint
- a shared chat/session/tooling platform
- optional sidecars for research, visuals, and persistent assets
- host-native apply/insert flows on top

The right move is not to clone DI-Copilot wholesale.
The right move is to extract the architecture and port the best ideas without dragging DI-specific baggage into Hermes.

## Research inputs used

Live repo inspected:
- `~/dev-workspaces/di-copilot/extensions/office/`

CGC health checks used:
- `./scripts/cgc list`
- `cgc-watch-all.sh --status`
- CGC call analysis confirmed the current PowerPoint insertion spine:
  - `insertAllSlides()` calls `detectTemplate()`
  - `insertAllSlides()` calls `getSlideCount()`
  - `insertAllSlides()` calls `insertViaReuse()`

Parallel architecture reviews completed for:
- Word
- Outlook
- PowerPoint

## Blunt conclusion

The DI-Copilot Office add-ins are not three separate products.
They are one Office platform with three host adapters.

That is exactly how Hermes Agent Office should be built.

Do not keep doing this piece by piece in a way that locks Word, Outlook, and PowerPoint into different internal architectures. That would be dumb and expensive.

## What DI-Copilot is doing well

### 1. Shared Office runtime
DI-Copilot already has a strong shared layer under `packages/shared`:
- chat/session runtime
- host-agnostic layout shell
- backend adapter seam
- research panel
- visual/asset panel
- assistant rendering
- attachments / drag-drop / voice
- session persistence

This is the single most important thing to copy conceptually.

### 2. Thin host-specific adapters
Each host mostly adds its own context and apply logic:
- Word → selection, insert/replace, markdown-to-Word, ingestion
- Outlook → current item context, thread continuity, compose/read handling, attachment ingest
- PowerPoint → slide context, fill-slide mode, template-aware insertion, deck generation

That separation is correct.

### 3. Tool/panel architecture
The add-ins do not try to cram everything into one message composer.
They expose tools and side panels for:
- research
- visuals
- settings
- host-specific workflows

That is a much better pattern than one giant taskpane blob.

### 4. Host-native apply loops
The best parts are where the AI output is not just text in chat, but something you can apply back into the host:
- Word insert/replace
- Outlook reply/help flows
- PowerPoint slide insertion / fill current slide

That is where Hermes should win.

## Per-host capability map from DI-Copilot

### Word
Current DI-Copilot Word strengths:
- document-scoped chat sessions
- live current selection tracking
- pinned snippets as working context
- document-type guidance / preferred skill selection
- markdown-aware insertion back into Word
- preview-before-apply document actions
- document upload / ingestion flows
- research panel integration
- visuals panel integration
- inline Mermaid rendering in chat

High-value Hermes takeaways:
- selection + pinned-context model
- markdown-to-Word insertion engine
- preview-before-apply
- document-scoped session continuity
- research and visuals as sidecars, not clutter in the main pane

### Outlook
Current DI-Copilot Outlook strengths:
- thread-aware session continuity
- message-specific fingerprinting for item-change detection
- robust compose vs read handling
- current email context in chat
- attachment ingestion workflows
- research + visuals sidecars
- image/diagram insertion into compose
- recent-session persistence

High-value Hermes takeaways:
- separate session continuity from item-switch detection
- stable compose-draft identities
- keep Outlook chat first, not a random pile of buttons
- preserve attachment and research workflows, but backed by Hermes semantics

### PowerPoint
Current DI-Copilot PowerPoint strengths:
- structured deck JSON generation path
- rich PPTX preview and export/insert flow
- fill-current-slide mode using shape role analysis
- template-aware insertion against existing masters/layouts
- reuse-mode logic for existing decks
- artifact/deck-type-aware prompting
- research + visuals sidecars
- critique panels (narrative/devil’s advocate)

High-value Hermes takeaways:
- fill-current-slide is gold
- structured deck JSON + preview + insert/download is gold
- template/master-aware insertion is useful
- reuse mode is interesting, but too dangerous as a default

## DI-specific baggage we should not copy

### Product baggage
Do not copy:
- DI branding
- Decision Inc branding
- DI-specific prompt copy
- DI-specific artifact slugs and naming
- DI-specific backend endpoint contracts
- DI-specific Knowledge Hub semantics

### Scope / storage baggage
Do not blindly inherit:
- personal/shared/kb scope model
- client-specific selectors
- DI replace-source/versioning semantics

Hermes needs its own storage model.

### Visual baggage
Do not make Draw.io part of the public default platform.

Mermaid should be the default visual grammar.
If richer visual editors return later, they must justify themselves instead of sneaking in because they already existed in DI-Copilot.

### Risky behavior baggage
Do not copy PowerPoint reuse-mode defaults as-is.
Anything that overwrites or reuses existing deck structure should be explicit and previewed.

## Recommended Hermes Office architecture

## 1. One Office platform, three host adapters

Shared platform should own:
- auth/session bridge integration
- chat runtime
- streaming / attachments / voice
- recent sessions
- research workspace
- visual workspace
- asset/template workspace
- backend client seam
- tool/panel routing

Host adapters should own:
- context extraction
- host-native apply/insert actions
- host-specific quick actions
- host-specific preview semantics

## 2. Shared capability model

Instead of one giant god-client, Hermes should move toward capabilities:
- chat
- sessions
- research
- visuals
- assets
- templates
- host-actions

But the frontend can still expose a single composed client for simplicity.

## 3. Assets and templates must be first-class

This is one of the most important product directions.

Hermes Office should support:
- saved visual assets
- saved prompt assets / reusable building blocks
- saved document templates
- saved deck templates
- saved brand themes

And later:
- user-uploaded logos / brand kits
- user-uploaded reference decks / documents
- regeneration from a saved asset/template with new content

This is where Hermes can beat DI-Copilot by being genuinely multi-tenant and reusable.

## 4. Theming/branding layer

Do not hardcode brand assumptions into Word/PowerPoint generation.

Hermes should have a theme layer that can drive:
- Word style mapping
- PowerPoint layout/theme mapping
- default colors/fonts/logo placement
- template family selection

The system should work well without branding, then upgrade when a user/org adds one.

## 5. Research/search must be cross-host, not one-off

Research should be a shared workspace usable from:
- Word
- Outlook
- PowerPoint

Core abilities:
- search internal knowledge
- search web/external sources
- pin findings
- synthesize findings
- save/load research sessions
- inject pinned findings back into chat or directly into host actions

That pattern is already validated by DI-Copilot.

## 6. Visuals should be Mermaid-first

Recommended Hermes baseline:
- Mermaid generation
- Mermaid preview
- Mermaid edit/refine loop
- convert Mermaid to image for host insertion
- save Mermaid diagrams as reusable assets

Optional later:
- richer diagram editors
- image generation variations
- asset collections

But the default mental model should stay simple.

## Recommended implementation phases

### Phase 0 — lock the platform contract
Before more feature work:
- define shared Office runtime boundaries
- define host adapter boundaries
- define asset/template/theme concepts
- define Hermes backend capability seams

### Phase 1 — strengthen Word as the reference host
Word should become the reference implementation for the shared platform.

Target features:
- document sessions
- selection context
- pinned snippets
- markdown-aware insertion
- quick actions
- research sidecar
- Mermaid visual sidecar
- basic asset save/use flow

### Phase 2 — add shared research + visuals + assets properly
Do this in shared, not ad hoc per host.

Deliverables:
- shared research workspace
- shared visuals workspace
- shared asset registry UI
- basic save/load/delete flows

### Phase 3 — Outlook parity on the shared runtime
Bring Outlook onto the same platform shape:
- current item context
- thread-aware sessions
- research sidecar
- visual insert support where valid
- attachment flows backed by Hermes storage semantics

### Phase 4 — PowerPoint parity on the shared runtime
Bring in the best PPT capabilities:
- deck JSON generation
- preview and insert/download
- fill-current-slide mode
- template/theme-aware insertion
- later: opt-in reuse mode

### Phase 5 — template and brand system
Once the platform is stable:
- user/org branding
- reusable document/deck types
- asset-backed generation
- recreate/regenerate flows

## What Hermes should port first from DI-Copilot

Top-tier ports:
1. shared chat/session/tool runtime
2. research sidecar pattern
3. visual sidecar pattern, but Mermaid-first
4. Word markdown insertion engine
5. Outlook session identity and item-change model
6. PowerPoint structured deck pipeline
7. PowerPoint fill-current-slide workflow

## What Hermes should not port first

Avoid for now:
- Excel parity
- DI knowledge-hub scope complexity
- Draw.io as a default path
- PowerPoint reuse-mode auto-overwrite behavior
- critique/audit specialty panels unless core PPT generation is already solid

## Proposed Hermes product surface

Think of the public Hermes Office add-ins as four layers:

### Layer 1: Core chat
- ask Hermes
- maintain host-scoped continuity

### Layer 2: Host-native actions
- Word: rewrite / expand / summarise / insert / replace
- Outlook: reply / summarise / ingest attachments / compose help
- PowerPoint: generate deck / fill slide / insert slides / apply visuals

### Layer 3: Shared workspaces
- Research
- Visuals
- Assets
- Templates

### Layer 4: Themes and regeneration
- bring your own branding
- recreate document/deck types from saved templates/assets/themes

## Immediate action items for Hermes-Agent-Office-Add-In

1. Stop thinking only in host-specific increments.
2. Introduce a shared Office platform spec and shared backlog.
3. Keep Word as the execution reference, but design shared capabilities intentionally.
4. Add a proper shared assets/templates concept before PowerPoint gets too custom.
5. Plan Outlook and PowerPoint against the same runtime model, not separate mini-products.

## My recommendation

The next serious work should not be another random Word feature.

It should be:
- formalize shared research / visuals / assets in the Hermes repo
- then continue Word using those shared contracts
- then bring Outlook and PowerPoint onto the same rails

That is the route to a real Office platform instead of a pile of taskpane hacks.
