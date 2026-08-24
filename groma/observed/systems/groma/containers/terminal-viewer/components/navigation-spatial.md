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

Moves selection to the nearest visible peer in an arrow's direction without changing scope. It also defines the only scope transition: Enter opens a container and Backspace returns to root.
