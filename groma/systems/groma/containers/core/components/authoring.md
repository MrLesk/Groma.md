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
      dependencies: 5
      dependents: 8
    - scanner: typescript
      file: src/add.ts
      dependencies: 8
      dependents: 1
    - scanner: typescript
      file: src/remove.ts
      dependencies: 8
      dependents: 1
    - scanner: typescript
      file: src/removable.ts
      dependencies: 1
      dependents: 2
---

Provides the shared add, draft, edit, remove and accept operations used by the command line and live web server. It adds people, external systems and draft records, validates removals, and delegates drafting, meaning edits and structural curation to their owning operations.
