---
id: tree
kind: component
parent: terminal-viewer
group: Navigation
code:
  - scanner: typescript
    file: src/viewers/tui/tree.ts
    symbol: initialTree
    dependencies: 2
    dependents: 5
---

# Tree

Turns the world into the hierarchy pane's visible rows, expand state, and cursor: actors, then systems, then external systems, in the same order as the map. Both viewers share it.
