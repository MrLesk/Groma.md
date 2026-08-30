---
id: create
kind: component
parent: cli
group: "Architecture authoring"
code:
  - scanner: typescript
    file: src/create.ts
    dependencies: 5
    dependents: 2
  - scanner: typescript
    file: src/naming.ts
    dependencies: 0
    dependents: 5
---

# Create

Authors new planned or observed architecture elements with stable IDs, valid containment, and optional system or technology annotations.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](../../core/components/architecture-reader.md) | Checks the merged world before writing | In-process data |
| [Architecture writer](../../core/components/architecture-writer.md) | Writes the new architecture document | In-process data |
