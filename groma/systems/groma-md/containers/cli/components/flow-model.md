---
type: C4 Component
title: Architecture flows
status: stable
groma:
  id: flow-model
  parent: cli
  code:
    - scanner: typescript
      file: src/flow-model.ts
      symbol: resolveFlows
    - scanner: typescript
      file: src/flow-authoring.ts
  group: Architecture records
---

Reads and writes ordered steps through existing relationships. Checks the endpoints and the direction of each step.
