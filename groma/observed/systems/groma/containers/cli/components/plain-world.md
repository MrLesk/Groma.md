---
id: plain-world
kind: component
parent: cli
code:
  - scanner: typescript
    file: src/plain-world.ts
    symbol: formatPlainWorld
---

# Plain world

Prints the merged world as plain text: every element with its kind, origin and relationships, for `groma view --plain`, for a single record, and for hosts without a terminal.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Core](../../core/container.md) | Loads the merged world | In-process data |
