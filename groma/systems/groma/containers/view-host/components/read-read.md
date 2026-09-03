---
type: C4 Component
title: Source inspection
status: stable
groma:
  id: read-read
  parent: view-host
  code:
    - scanner: typescript
      file: src/viewers/source/read.ts
      dependencies: 2
      dependents: 7
    - scanner: typescript
      file: src/viewers/source/structure.ts
      dependencies: 2
      dependents: 11
    - scanner: typescript
      file: src/viewers/source/diff.ts
      dependencies: 3
      dependents: 7
    - scanner: typescript
      file: src/viewers/source/diff-lines.ts
      dependencies: 0
      dependents: 5
---

Reads component source, declarations, and task file diffs for every viewer.
