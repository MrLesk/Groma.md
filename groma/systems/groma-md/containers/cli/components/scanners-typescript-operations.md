---
type: C4 Component
title: Operation body analysis
status: stable
groma:
  id: scanners-typescript-operations
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/typescript-operations.ts
      symbol: typeScriptOperations
  group: Scanner support
description: Tokenises TypeScript operation bodies for duplication comparison
---

Converts operation bodies into comparable tokens for TypeScript-based scanners. Keeps source structure available for duplication analysis.
