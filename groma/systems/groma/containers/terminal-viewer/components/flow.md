---
type: C4 Component
title: Flow
status: stable
groma:
  id: flow
  parent: terminal-viewer
  group: Navigation
  code:
    - scanner: typescript
      file: src/viewers/tui/flow.ts
      dependencies: 4
      dependents: 5
---

Projects actor command paths into the visible terminal scope and provides their explanatory labels.
