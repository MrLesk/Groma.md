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
      dependencies: 5
      dependents: 3
    - scanner: typescript
      file: src/move.ts
      symbol: moveBlocker
      dependencies: 1
      dependents: 2
---

Curates architecture through validated edits: group or ungroup sibling components, move empty scan evidence, combine empty records and add, edit or remove a directed relationship. It preserves existing authored meaning and refuses structural replacements that would discard it.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture model](../../core/components/architecture-model.md) | Validates the observed structure before mutation | In-process data |
| [Architecture writer](../../core/components/architecture-writer.md) | Writes validated structural changes | In-process data |
