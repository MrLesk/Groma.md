---
id: navigation-spatial
kind: component
parent: terminal-viewer
group: Navigation
code:
  - scanner: typescript
    file: src/viewers/tui/navigation-spatial.ts
    symbol: canEnter
---

# Navigation spatial

Moves the selection across the map: the nearest sibling in an arrow's direction, the exit to the outer item when no sibling is left that way, and what Enter descends into.
