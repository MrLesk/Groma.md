---
id: typescript-graph
kind: component
parent: scanner
code:
  - scanner: typescript
    file: src/typescript-graph.ts
    symbol: kebabCase
---

# Typescript graph

Builds file-level import evidence for the TypeScript scanner: relative imports, reverse importers, first exported symbols, and source labels. It does not decide C4 containers or components.
