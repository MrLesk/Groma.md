---
type: C4 Component
title: TypeScript source outline
status: stable
groma:
  id: src-structure
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/typescript/src/structure.ts
      symbol: readCodeStructure
  group: Language analysis
description: Reads the declaration outline of a TypeScript file
---

Reads the declarations in a TypeScript file. Supplies the source outline used in component details.
