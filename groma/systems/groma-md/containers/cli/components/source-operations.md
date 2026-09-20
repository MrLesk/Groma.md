---
type: C4 Component
title: TypeScript operations
status: stable
groma:
  id: source-operations
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/typescript/src/source-operations.ts
      symbol: sourceOperations
  group: Language analysis
---

Reads TypeScript operations and their source positions. Supplies call evidence and tokens for the review of possible copies.
