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

The generic TypeScript plugin. It turns the import graph into C4 candidates: one system, the CLI and its sibling containers, a component for every other file, with Code references and import relationships. It requires no Groma types, comments, or ids in application source.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Typescript files](typescript-files.md) | Picks the files to read | In-process data |
| [Typescript graph](typescript-graph.md) | Builds the import graph and names the candidates | In-process data |
