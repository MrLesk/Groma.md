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
      file: src/scanner/typescript/files.ts
      dependencies: 0
      dependents: 3
    - scanner: typescript
      file: src/scanner/typescript/graph.ts
      dependencies: 3
      dependents: 1
    - scanner: typescript
      file: src/scanner/typescript/scan.ts
      symbol: scanTypeScriptSource
      dependencies: 4
      dependents: 1
---

Reports supported TypeScript source files and named symbols separately, using imports and entry points only as evidence for placement and dependency counts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Scan observation](scan-observation.md) | Publishes one complete observation | In-process data |
| [Git](../../../../git/system.md) | Lists tracked and unignored source files | git ls-files |
