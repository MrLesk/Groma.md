---
type: C4 Component
title: Viewer semantics
status: stable
groma:
  id: viewer-semantics
  parent: view-host
  group: Shared projections
  code:
    - scanner: typescript
      file: src/viewers/relationship-text.ts
    - scanner: typescript
      file: src/viewers/atoms/kind.ts
    - scanner: typescript
      file: src/empty-world.ts
      symbol: isEmptyWorld
    - scanner: typescript
      file: src/brand.ts
    - scanner: typescript
      file: src/viewers/flows.ts
---

Defines the shared visual language and navigation meaning used by the terminal and browser: kind labels, relationship captions, explicit authored flow membership, brand accents and the next steps for an empty architecture.
