# Product Decisions

## Fixed decisions for the public repo

### 1. Default port
- HTTPS default: `3446`
- HTTP fallback/dev port: `3300`

### 2. Identity
This repo is native Hermes.

That means:
- no OpenClaw branding
- no Decision Inc branding
- no consultancy-specific assumptions in manifests, docs, or UI copy

### 3. Reference source
`openclaw-office` is reference material only.

We reuse patterns that are good:
- thin local bridge
- Office add-in packaging shape
- shared frontend modules
- session/token separation

We do not inherit its baggage.

### 4. Assets and templates
User-owned assets and templates should be first-class.

Planned directions:
- upload assets from add-ins
- upload/import templates
- let Hermes help generate template drafts
- keep templates generic enough for public users, not tied to one consultancy workflow

### 5. Research and save
Research/search + save flows should be first-class in:
- Word
- Outlook
- PowerPoint

Excel can follow later once the shared model is stable.

### 6. Visuals
Mermaid is the default visual path.

Public baseline decision:
- keep Mermaid
- remove draw.io from the default option set

If richer visual editors come back later, they should be justified as product features, not inherited leftovers.

### 7. Release order
1. Word
2. PowerPoint
3. Outlook
4. Excel

That order gives the fastest route to something useful without drowning in Outlook weirdness too early.
