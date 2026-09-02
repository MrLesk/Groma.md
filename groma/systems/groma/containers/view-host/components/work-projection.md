---
type: C4 Component
title: Work projection
status: stable
groma:
  id: work-projection
  parent: view-host
  group: Shared projections
  code:
    - scanner: typescript
      file: src/work/pins.ts
      dependencies: 1
      dependents: 10
---

Maps Backlog tasks to their exact architecture references or newest owned source file so every viewer receives the same task anchors.
