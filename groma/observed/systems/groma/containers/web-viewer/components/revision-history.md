---
type: C4 Component
title: Revision history
status: stable
groma:
  id: revision-history
  parent: web-viewer
  code:
    - scanner: typescript
      file: src/viewers/web/revision/control.ts
      symbol: createRevisionControl
      dependencies: 1
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/revision/view.ts
      dependencies: 1
      dependents: 1
    - scanner: typescript
      file: src/history/git.ts
      dependencies: 0
      dependents: 6
---

Selects a Git revision for the browser map and supplies exact historical file content to revision-aware inspection.
