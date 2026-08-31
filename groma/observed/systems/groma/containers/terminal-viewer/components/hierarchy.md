---
type: C4 Component
title: Hierarchy
status: stable
groma:
  id: hierarchy
  parent: terminal-viewer
  group: Navigation
  code:
    - scanner: typescript
      file: src/viewers/tui/organisms/hierarchy.ts
      dependencies: 6
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/tree.ts
      dependencies: 2
      dependents: 5
---

Draws the terminal architecture tree and owns its visible rows, expansion state, and focused cursor without changing map geometry.
