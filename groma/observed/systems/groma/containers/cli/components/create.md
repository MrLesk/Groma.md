---
id: create
kind: component
parent: cli
group: Commands
code:
  - scanner: typescript
    file: src/create.ts
    symbol: ensurePlanReadme
    dependencies: 4
    dependents: 2
---

# Create

Authors a plan ghost: writes the plan README when the plan is new and one element document for the part that does not exist yet, under the id it will keep when accepted. Parents resolve against the merged world, so a planned component may name an observed container.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](../../core/components/architecture-reader.md) | Checks the merged world before writing | In-process data |
| [Markdown emitter](../../core/components/markdown-emitter.md) | Writes the plan documents | In-process data |
