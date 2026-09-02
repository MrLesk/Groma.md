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
      file: src/viewers/action-path.ts
      dependencies: 2
      dependents: 12
    - scanner: typescript
      file: src/viewers/relationship-text.ts
      dependencies: 0
      dependents: 4
    - scanner: typescript
      file: src/viewers/atoms/kind.ts
      dependencies: 1
      dependents: 9
---

Owns shared viewer meaning for element kinds, relationship captions, and actor command paths so browser and terminal views explain the same graph.
