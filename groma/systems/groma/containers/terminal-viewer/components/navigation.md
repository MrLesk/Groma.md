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
      dependencies: 10
      dependents: 8
    - scanner: typescript
      file: src/viewers/tui/navigation-spatial.ts
      dependencies: 5
      dependents: 1
---

Reduces every terminal key over one viewer state and moves selection by the nearest visible peer, including container scope and temporary Work focus.
