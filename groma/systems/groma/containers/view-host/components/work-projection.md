---
type: C4 Component
title: Work projection
status: stable
groma:
  id: work-projection
  parent: view-host
  group: Shared projections
  code:
    - scanner: typescript
      file: src/work/pins.ts
      dependencies: 1
      dependents: 11
    - scanner: typescript
      file: src/work/status-filter.ts
      dependencies: 0
      dependents: 2
---

Maps tasks to exact architecture references or their newest owned source file. It supplies shared task anchors and status-filter rules, preserving a viewer's visibility choices when task snapshots change.
