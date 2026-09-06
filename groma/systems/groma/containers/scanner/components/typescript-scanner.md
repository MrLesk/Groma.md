---
type: C4 Component
title: TypeScript scanner
status: stable
groma:
  id: typescript-scanner
  parent: scanner
  group: Language scanners
  code:
    - scanner: typescript
      file: plugins/scanners/typescript/src/index.ts
    - scanner: typescript
      file: plugins/scanners/typescript/src/files.ts
    - scanner: typescript
      file: plugins/scanners/typescript/src/graph.ts
    - scanner: typescript
      file: plugins/scanners/typescript/src/scan.ts
      symbol: scanTypeScriptSource
    - scanner: typescript
      file: plugins/scanners/typescript/src/naming.ts
    - scanner: typescript
      file: plugins/scanners/typescript/src/source-usage.ts
      symbol: usedImportSpecifiers
    - scanner: typescript
      file: plugins/scanners/typescript/src/source-analysis.ts
    - scanner: typescript
      file: plugins/scanners/typescript/src/source-operations.ts
      symbol: sourceOperations
    - scanner: typescript
      file: plugins/scanners/typescript/src/worker.ts
      symbol: typescriptWorkerPath
---

Exports the embedded TypeScript scanner module and reports supported source files and named symbols separately, using imports and entry points only as evidence for placement and dependency counts.
