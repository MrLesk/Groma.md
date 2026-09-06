---
type: C4 Component
title: Architecture authoring
status: stable
groma:
  id: authoring
  parent: core
  code:
    - scanner: typescript
      file: src/authoring.ts
      symbol: writes
    - scanner: typescript
      file: src/add.ts
    - scanner: typescript
      file: src/remove.ts
    - scanner: typescript
      file: src/removable.ts
    - scanner: typescript
      file: src/flow-authoring.ts
---

Provides the shared add, draft, edit, remove and accept operations used by the command line and live web server. It authors actors, external systems, draft records and explicit flows, validates removals, and delegates element drafting, meaning edits and structural curation to their owning operations.
