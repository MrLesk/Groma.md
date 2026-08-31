---
type: C4 Component
title: World loader
status: stable
groma:
  id: world-loader
  parent: core
  group: Architecture world
  code:
    - scanner: typescript
      file: src/core.ts
      dependencies: 7
      dependents: 6
---

Loads every revision into one annotated architecture graph, resolves winning representations, stable relationships, direct children, and source-file measurements for all viewers.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture model](architecture-model.md) | Builds one semantic graph | In-process data |
| [Architecture reader](architecture-reader.md) | Reads every architecture revision | In-process data |
