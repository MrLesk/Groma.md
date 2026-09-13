---
type: C4 Component
title: Source reader
status: stable
groma:
  id: source-read
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/source/read.ts
    - scanner: typescript
      file: src/viewers/source/structure.ts
      symbol: readCodeStructure
    - scanner: typescript
      file: src/viewers/source/highlight.ts
  group: Shared viewer data
---

Reads the source files and declaration outlines owned by a component. Supplies code tokens for the viewers.
