---
id: world-loader
kind: component
parent: core
group: "Architecture world"
code:
  - scanner: typescript
    file: src/core.ts
    dependencies: 6
    dependents: 5
---

# World loader

Loads every revision into one annotated architecture graph, resolves winning representations, stable relationships, direct children, and source-file measurements for all viewers.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture model](architecture-model.md) | Builds one semantic graph | In-process data |
| [Architecture reader](architecture-reader.md) | Reads every architecture revision | In-process data |
