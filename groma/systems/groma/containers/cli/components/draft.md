---
type: C4 Component
title: Draft
status: stable
groma:
  id: draft
  parent: cli
  code:
    - scanner: typescript
      file: src/draft.ts
      dependencies: 7
      dependents: 1
    - scanner: typescript
      file: src/naming.ts
      dependencies: 0
      dependents: 10
  group: Architecture authoring
---

Drafts a new system, container, or component as a ghost at the path it will keep once accepted. The kind is checked against the parent, the id is the kebab-case of the name, and an optional draft record names the outcome the ghost belongs to.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](../../core/components/architecture-reader.md) | Checks the current world before writing | In-process data |
| [Architecture writer](../../core/components/architecture-writer.md) | Writes the ghost document | In-process data |
