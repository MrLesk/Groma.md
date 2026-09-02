---
type: C4 Component
title: Work source contract
status: stable
groma:
  id: work-source-contract
  parent: view-host
  group: Live sources
  code:
    - scanner: typescript
      file: packages/work-source/src/index.ts
      dependencies: 0
      dependents: 0
---

Defines the public work snapshot, selected-item detail, watch lifecycle,
readiness, and empty-source behavior implemented by embedded work-source
plugins.
