---
id: edit
kind: component
parent: cli
group: "Architecture authoring"
code:
  - scanner: typescript
    file: src/edit.ts
    symbol: editArchitecture
    dependencies: 6
    dependents: 1
---

# Edit

Updates current meaning or restates an existing element in a plan while preserving the rest of its authored document.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](../../core/components/architecture-reader.md) | Finds the current owner of authored meaning | In-process data |
| [Create](create.md) | Creates a plan record when needed | In-process data |
| [Architecture writer](../../core/components/architecture-writer.md) | Rewrites only the requested authored meaning | In-process data |
| [Observed curation](observed-curation.md) | Delegates structural observed edits | In-process data |
