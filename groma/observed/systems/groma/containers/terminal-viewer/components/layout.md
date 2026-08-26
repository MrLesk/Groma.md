---
id: layout
kind: component
parent: terminal-viewer
group: Projection
code:
  - scanner: typescript
    file: src/viewers/tui/layout.ts
    symbol: paneLayout
    dependencies: 1
    dependents: 5
---

# Layout

Reserves the header, footer, three pane widths, and one map-bottom Backlog recap row for a terminal size. The camera viewport never renders under a pane or the recap.
