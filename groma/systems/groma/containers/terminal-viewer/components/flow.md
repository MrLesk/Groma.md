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
      dependents: 4
    - scanner: typescript
      file: src/viewers/tui/flow-navigation.ts
      symbol: reduceFlowReading
      dependencies: 4
      dependents: 1
---

Projects an authored flow step onto its exact endpoints and their visible ancestors. It separates reading ordered actions from inspecting an endpoint, preserving the selected scenario and step when the architect returns.
