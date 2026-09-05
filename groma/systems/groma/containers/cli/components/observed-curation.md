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
      dependencies: 5
      dependents: 1
    - scanner: typescript
      file: src/group.ts
      dependencies: 5
      dependents: 3
    - scanner: typescript
      file: src/relation.ts
      dependencies: 6
      dependents: 4
    - scanner: typescript
      file: src/move.ts
      symbol: moveBlocker
      dependencies: 1
      dependents: 2
---

Curates architecture through shared validated operations: group sibling components, move empty scan evidence, combine empty records, and create, edit or explicitly accept directed relationships. Only draft relationships without flow references can be removed; current relationships are protected. Planned relationships keep their own draft lifecycle independently of endpoint status. Changes validate before writing and preserve authored meaning; structural replacements that would discard meaning are refused.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture model](../../core/components/architecture-model.md) | Validates the observed structure before mutation | In-process data |
| [Architecture writer](../../core/components/architecture-writer.md) | Writes validated structural changes | In-process data |
