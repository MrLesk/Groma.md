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
      file: src/viewers/tui/tree.ts
    - scanner: typescript
      file: src/viewers/tui/panes/hierarchy.ts
---

Draws the terminal architecture tree and owns its visible rows, expansion state, and focused cursor without changing map geometry.
