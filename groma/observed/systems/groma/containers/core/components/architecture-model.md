---
id: architecture-model
kind: component
parent: core
code:
  - scanner: typescript
    file: src/architecture-model.ts
    symbol: buildArchitectureModel
---

# Architecture model

Merges observed architecture and planned fragments into one world: one element per architecture ID, parents resolved across locations, planned documents as ghosts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World layout](world-layout.md) | Supplies the complete annotated architecture | In-process data |
