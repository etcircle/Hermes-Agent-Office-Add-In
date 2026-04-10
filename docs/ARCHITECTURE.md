# Architecture

## Opinionated take

The best solution is not a fat Office add-in that talks straight to Hermes from the browser. That's fragile and leaks too much surface area.

The right design is a thin localhost bridge:
- Office taskpane loads from `https://localhost:3445/{app}/`
- browser authenticates only to the local bridge
- bridge proxies `/api/*` to Hermes API Server / gateway
- bridge injects server-side auth headers and strips anything the browser should never know
- Hermes backend remains swappable: local CLI gateway, API server, or remote host through SSH tunnel

## Why this is the right shape

1. Office manifests want stable HTTPS origins.
2. Browser JavaScript must not hold long-lived Hermes secrets.
3. Localhost is the cleanest sideload default.
4. Remote-host development is still easy through SSH tunneling.
5. This keeps the public repo installable without requiring people to modify the Hermes core repo.

## Phase 1 contract

### Local bridge
- host Office assets on localhost
- expose `/health`
- expose `/auth/login`
- expose `/api/v1/responses` passthrough to Hermes API Server
- maintain short-lived local session tokens in memory or signed cookies
- enforce allowlisted origins

### Hermes backend integration
Default target:
- `HERMES_API_BASE_URL=http://127.0.0.1:8642`

Expected bridge behavior:
- add the server-side Hermes auth header or bearer token required by the API server
- preserve streaming where possible
- keep model choice admin-configurable server-side, never hardcoded in the add-in UI


## Authentication recommendation

### Phase 1: passphrase + local session
Use a local passphrase only to unlock the bridge, not as the backend credential itself.

Flow:
1. user opens add-in
2. add-in hits `/auth/login`
3. local bridge validates `OFFICE_ADDIN_PASSPHRASE`
4. bridge issues a short-lived session token
5. browser stores only that short-lived token
6. bridge uses `HERMES_API_KEY` server-side for backend requests

This is dead simple and good enough for local-first public setup.

### Phase 2: OAuth / device flow
Later, add a proper Hermes sign-in flow if the backend supports it. Do not block the public repo on that.

## App strategy

### Shared first
Build `packages/shared` first:
- auth/session
- Hermes client wrapper
- shared shell/layout
- streaming response renderer
- Office host detection helpers

### Then app order
1. Word
2. PowerPoint
3. Outlook
4. Excel

Word is the least messy path to a shippable first release. Outlook is the most annoying because Office mail APIs are full of little traps.

## Manifest strategy

Default every manifest to localhost.

Base URLs:
- HTTPS: `https://localhost:3445`
- HTTP: `http://localhost:3300`

Each app gets its own manifest under `packages/{app}/public/manifest.xml`.
Do not hardcode cloud domains into the default manifest. That's how you end up with broken sideloading for half the planet.

## What not to copy from openclaw-office

- stale DI/OpenClaw branding and IDs
- mixed product docs pretending history is architecture
- direct product-specific assumptions in shared config
- browser-facing auth that can drift from Hermes core auth
- ghost features wired only halfway

Use it as a reference implementation, not as sacred scripture.
