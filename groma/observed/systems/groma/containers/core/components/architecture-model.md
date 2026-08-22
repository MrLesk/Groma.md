---
id: architecture-model
kind: component
parent: core
group: World building
code:
  - scanner: typescript
    file: src/architecture-model.ts
    symbol: buildArchitectureModel
---

# Architecture model

Turns revision documents into one world: one element per architecture id, parents resolved across observed architecture and plans, relationship targets resolved by id, every containment rule checked, and planned documents marked as ghosts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World layout](world-layout.md) | Supplies the complete annotated architecture | In-process data |
