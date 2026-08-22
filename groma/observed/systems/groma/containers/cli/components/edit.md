---
id: edit
kind: component
parent: cli
code:
  - scanner: typescript
    file: src/edit.ts
    symbol: editArchitecture
---

# Edit

Records a required change as a plan that restates an existing id, or updates the lead prose of an observed element or a plan's Outcome. It touches nothing else in the document, so curated meaning survives.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](../../core/components/architecture-reader.md) | Loads the observed and planned documents | In-process data |
| [Create](create.md) | Creates the plan README when the plan is new | In-process data |
| [Markdown emitter](../../core/components/markdown-emitter.md) | Rewrites only the lead prose | In-process data |
