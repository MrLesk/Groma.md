---
type: C4 Component
title: Navigation
status: stable
groma:
  id: navigation
  parent: terminal-viewer
  group: Navigation
  code:
    - scanner: typescript
      file: src/viewers/tui/navigation.ts
    - scanner: typescript
      file: src/viewers/tui/navigation-details.ts
    - scanner: typescript
      file: src/viewers/tui/navigation-search.ts
    - scanner: typescript
      file: src/viewers/tui/navigation-spatial.ts
    - scanner: typescript
      file: src/viewers/tui/navigation-tree.ts
      symbol: reduceTree
    - scanner: typescript
      file: src/viewers/tui/keys.ts
---

Owns terminal keyboard actions and navigation state: map selection, pane focus, hierarchy browsing, architecture search, flow toggles and reading cursors. It follows cards by their rectangles, opens exact source and task links, and preserves the reading position when a file closes.
