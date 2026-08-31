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
      dependencies: 7
      dependents: 1
---

Updates body overview or the optional concise description independently, or
restates an existing concept as a draft plan representation. It preserves
unowned OKF metadata, nested Groma metadata outside the requested structural
change, and every named Markdown section.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](../../core/components/architecture-reader.md) | Finds the current owner of authored meaning | In-process data |
| [Create](create.md) | Creates a plan record when needed | In-process data |
| [Architecture writer](../../core/components/architecture-writer.md) | Rewrites only the requested authored meaning | In-process data |
| [Observed curation](observed-curation.md) | Delegates structural observed edits | In-process data |
