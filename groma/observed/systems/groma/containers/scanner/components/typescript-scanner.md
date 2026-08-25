---
id: typescript-scanner
kind: component
parent: scanner
code:
  - scanner: typescript
    file: src/scanner/typescript/scan.ts
    symbol: scanTypeScriptSource
---

# TypeScript scanner

Reports each supported source file and exported symbol separately. Imports and directories infer placement and source relationships, but never combine files into an architecture component.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Git](../../../../git/system.md) | Lists tracked source files | git ls-files |
| [Scanner observation](scanner-observation.md) | Publishes one complete observation | In-process data |
