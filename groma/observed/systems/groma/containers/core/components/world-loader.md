---
id: world-loader
kind: component
parent: core
code:
  - scanner: typescript
    file: src/core.ts
    symbol: annotateArchitecture
    dependencies: 6
    dependents: 7
---

# World loader

Loads the merged semantic architecture for every caller: reads the observed and planned documents, builds one annotated graph with stable relationship ids, and measures both every code file and each component total. The web sheet consumes this graph directly; the terminal path adds its fixed world layout afterwards.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](architecture-reader.md) | Reads every revision document | In-process data |
| [Architecture model](architecture-model.md) | Merges the revisions into one world | In-process data |
