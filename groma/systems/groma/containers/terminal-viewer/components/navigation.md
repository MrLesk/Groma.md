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
      dependencies: 17
      dependents: 15
    - scanner: typescript
      file: src/viewers/tui/navigation-details.ts
      dependencies: 6
      dependents: 2
    - scanner: typescript
      file: src/viewers/tui/navigation-search.ts
      dependencies: 5
      dependents: 3
    - scanner: typescript
      file: src/viewers/tui/navigation-spatial.ts
      dependencies: 6
      dependents: 4
    - scanner: typescript
      file: src/viewers/tui/navigation-tree.ts
      symbol: reduceTree
      dependencies: 5
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/keys.ts
      dependencies: 1
      dependents: 2
---

Owns terminal keyboard actions and navigation state: map selection, pane focus, hierarchy browsing, architecture search, flow toggles and reading cursors. It follows cards by their rectangles, opens exact source and task links, and preserves the reading position when a file closes.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Navigation history](navigation-history.md) | Delegates revision-list state | TypeScript |
