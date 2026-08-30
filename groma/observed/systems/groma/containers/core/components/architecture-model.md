---
id: architecture-model
kind: component
parent: core
group: "Architecture world"
code:
  - scanner: typescript
    file: src/architecture-model.ts
    dependencies: 1
    dependents: 3
  - scanner: typescript
    file: src/types.ts
    dependencies: 0
    dependents: 70
  - scanner: typescript
    file: src/element-order.ts
    symbol: compareSemanticElements
    dependencies: 1
    dependents: 6
  - scanner: typescript
    file: scripts/validate-architecture.ts
    dependencies: 1
    dependents: 0
---

# Architecture model

Turns revision documents into a validated semantic graph with stable IDs, containment, groups, technology, Code ownership, and resolved directed relationships.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World layout](world-layout.md) | Supplies the semantic graph for terminal layout | In-process data |
