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
      dependencies: 6
      dependents: 6
---

Projects actor command paths into the visible terminal scope and provides their explanatory labels.
