---
id: typescript-scanner
kind: component
parent: scanner
group: Language scanners
code:
  - scanner: typescript
    file: src/scanner/typescript/files.ts
    symbol: listTypeScriptFiles
    dependencies: 0
    dependents: 3
  - scanner: typescript
    file: src/scanner/typescript/graph.ts
    symbol: buildImportGraph
    dependencies: 3
    dependents: 1
  - scanner: typescript
    file: src/scanner/typescript/scan.ts
    symbol: scanTypeScriptSource
    dependencies: 4
    dependents: 1
---

# TypeScript scanner

Reports each supported source file and exported symbol separately. Imports and directories infer placement without combining files into an architecture component. Resolved imports also become deterministic file-to-file source-dependency evidence.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Git](../../../../git/system.md) | Lists tracked source files | git ls-files |
| [Scanner observation](scanner-observation.md) | Publishes one complete observation | In-process data |
