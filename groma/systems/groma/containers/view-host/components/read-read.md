---
type: C4 Component
title: Source and diff reads
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
      dependents: 9
    - scanner: typescript
      file: src/viewers/source/diff-lines.ts
      dependencies: 0
      dependents: 4
    - scanner: typescript
      file: src/viewers/source/highlight.ts
      dependencies: 0
      dependents: 3
---

Reads exact component source, declarations and task file changes for both viewers. It supplies one diff payload for file summaries and opened diffs, and shared syntax tokens that each viewer paints in its own theme.
