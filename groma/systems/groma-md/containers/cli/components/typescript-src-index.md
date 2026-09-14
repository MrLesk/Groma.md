---
type: C4 Component
title: TypeScript analysis
status: stable
groma:
  id: typescript-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/typescript/src/index.ts
    - scanner: typescript
      file: plugins/scanners/typescript/src/scan.ts
      symbol: scanTypeScriptSource
    - scanner: typescript
      file: plugins/scanners/typescript/src/files.ts
    - scanner: typescript
      file: plugins/scanners/typescript/src/projects.ts
    - scanner: typescript
      file: plugins/scanners/typescript/src/graph.ts
    - scanner: typescript
      file: plugins/scanners/typescript/src/naming.ts
    - scanner: typescript
      file: plugins/scanners/typescript/src/source-analysis.ts
    - scanner: typescript
      file: plugins/scanners/typescript/src/source-imports.ts
      symbol: resolvedImports
    - scanner: typescript
      file: plugins/scanners/typescript/src/source-usage.ts
      symbol: usedImportSpecifiers
  group: Language analysis
---

Selects TypeScript projects and source files. Uses the compiler to collect declarations and imports, then returns source evidence.
