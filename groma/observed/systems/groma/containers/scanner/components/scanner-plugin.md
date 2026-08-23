---
id: scanner-plugin
kind: component
parent: scanner
code:
  - scanner: typescript
    file: src/typescript-scanner.ts
    symbol: formatTypeScriptObservation
---

# Scanner plugin

Owns the TypeScript-to-C4 mapping. It turns file-level import evidence into one system, container and component candidates with Code references, plus relationships for the standalone observation. scanTypeScriptSource returns only the candidates for core to fold. Application source needs no Groma types, comments, or IDs.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Typescript files](typescript-files.md) | Picks the files to read | In-process data |
| [Typescript graph](typescript-graph.md) | Builds the import graph and names the candidates | In-process data |
