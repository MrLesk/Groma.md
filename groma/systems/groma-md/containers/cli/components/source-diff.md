---
type: C4 Component
title: Task change reader
status: stable
groma:
  id: source-diff
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/source/diff.ts
    - scanner: typescript
      file: src/viewers/source/diff-lines.ts
  group: Shared viewer data
---

Reads the file changes associated with a task. Prepares the source line differences for the viewers.
