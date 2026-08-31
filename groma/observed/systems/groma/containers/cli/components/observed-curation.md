---
type: C4 Component
title: Observed curation
status: stable
groma:
  id: observed-curation
  parent: cli
  group: Architecture authoring
  code:
    - scanner: typescript
      file: src/curate.ts
      dependencies: 4
      dependents: 1
    - scanner: typescript
      file: src/relate.ts
      symbol: relateObserved
      dependencies: 3
      dependents: 1
---

Curates atomic scan evidence through validated whole operations: group or ungroup a component, move empty evidence, combine empty records, and author one observed relationship.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture model](../../core/components/architecture-model.md) | Validates the observed structure before mutation | In-process data |
| [Architecture writer](../../core/components/architecture-writer.md) | Writes validated structural changes | In-process data |
