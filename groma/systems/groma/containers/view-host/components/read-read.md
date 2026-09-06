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
    - scanner: typescript
      file: src/viewers/source/structure.ts
    - scanner: typescript
      file: src/viewers/source/diff.ts
    - scanner: typescript
      file: src/viewers/source/diff-lines.ts
    - scanner: typescript
      file: src/viewers/source/highlight.ts
---

Reads exact component source, declarations and task file changes for both viewers. It supplies one diff payload for file summaries and opened diffs, and shared syntax tokens that each viewer paints in its own theme.
