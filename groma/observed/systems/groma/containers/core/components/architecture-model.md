---
type: C4 Component
title: Architecture model
status: stable
groma:
  id: architecture-model
  parent: core
  group: Architecture world
  code:
    - scanner: typescript
      file: src/architecture-model.ts
      dependencies: 4
      dependents: 3
    - scanner: typescript
      file: src/types.ts
      dependencies: 0
      dependents: 74
    - scanner: typescript
      file: src/element-order.ts
      symbol: compareSemanticElements
      dependencies: 1
      dependents: 6
    - scanner: typescript
      file: scripts/validate-architecture.ts
      dependencies: 4
      dependents: 0
    - scanner: typescript
      file: src/architecture-markdown.ts
      dependencies: 1
      dependents: 1
    - scanner: typescript
      file: src/code-reference.ts
      symbol: codeReferencesOf
      dependencies: 1
      dependents: 1
---

Turns C4 concepts into a validated semantic graph. It maps standard type,
title, and optional description directly; derives overview from leading body
prose; and reads stable identity, containment, groups, technology, and Code
ownership from the nested Groma metadata. It resolves strict directed
relationship tables into graph edges.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World layout](world-layout.md) | Supplies the semantic graph for terminal layout | In-process data |
