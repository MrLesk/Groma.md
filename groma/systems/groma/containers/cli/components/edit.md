---
type: C4 Component
title: Edit
status: stable
groma:
  id: edit
  parent: cli
  group: Architecture authoring
  code:
    - scanner: typescript
      file: src/edit.ts
      symbol: editArchitecture
      dependencies: 9
      dependents: 1
---

Changes authored meaning by id: the lead overview or concise description of an element or a draft record, the draft tag that says which draft touches an element, and the structural curation of scanned evidence (group, ungroup, move, combine). It preserves unowned OKF metadata, nested Groma metadata outside the requested change, and every named Markdown section.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](../../core/components/architecture-reader.md) | Finds the current owner of authored meaning | In-process data |
| [Architecture writer](../../core/components/architecture-writer.md) | Rewrites only the requested authored meaning | In-process data |
| [Observed curation](observed-curation.md) | Delegates structural edits of scanned evidence | In-process data |
