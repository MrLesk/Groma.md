---
id: architecture-model
kind: component
parent: core
group: World building
code:
  - scanner: typescript
    file: src/architecture-model.ts
    symbol: buildArchitectureModel
    dependencies: 1
    dependents: 1
  - scanner: typescript
    file: src/element-order.ts
    symbol: compareSemanticElements
    dependencies: 1
    dependents: 5
  - scanner: typescript
    file: src/types.ts
    dependencies: 0
    dependents: 60
  - scanner: typescript
    file: test/architecture-model-helpers.ts
    dependencies: 1
    dependents: 0
---

# Architecture model

Turns revision documents into one world: one element per architecture id, parents resolved across observed architecture and plans, relationship targets resolved by id, every containment rule checked, and planned documents marked as ghosts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World layout](world-layout.md) | Supplies the complete annotated architecture | In-process data |
