---
id: world-loader
kind: component
parent: core
code:
  - scanner: typescript
    file: src/core.ts
    symbol: annotateArchitecture
---

# World loader

Loads the merged world for every caller: reads the observed and planned documents, builds one annotated world with the lines behind each component's code, and lays it out for the viewers. The CLI, the terminal host and the web server all start here.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](architecture-reader.md) | Reads every revision document | In-process data |
| [Architecture model](architecture-model.md) | Merges the revisions into one world | In-process data |
