---
type: C4 Component
title: Backlog plugin
status: stable
groma:
  id: backlog-plugin
  parent: view-host
  group: Live sources
  code:
    - scanner: typescript
      file: src/work/backlog.ts
      dependencies: 1
      dependents: 3
---

Reads the configured Backlog workflow and tasks and watches task records without blocking architecture rendering.
