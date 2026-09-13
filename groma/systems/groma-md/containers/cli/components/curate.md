---
type: C4 Component
title: Component structure
status: stable
groma:
  id: curate
  parent: cli
  code:
    - scanner: typescript
      file: src/curate.ts
    - scanner: typescript
      file: src/move.ts
      symbol: moveBlocker
    - scanner: typescript
      file: src/group.ts
  group: Architecture records
---

Combines source evidence into one component. Moves empty components and assigns named groups without changing source file ownership.
