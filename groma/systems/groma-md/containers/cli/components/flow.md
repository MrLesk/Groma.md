---
type: C4 Component
title: Terminal flow reader
status: stable
groma:
  id: flow
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/tui/flow.ts
    - scanner: typescript
      file: src/viewers/tui/flow-navigation.ts
      symbol: reduceFlowReading
  group: Terminal map
---

Selects a flow step and highlights its endpoints on the terminal map.
