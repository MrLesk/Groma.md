---
type: C4 Component
title: Plain text view
status: stable
groma:
  id: plain-text-view
  parent: cli
  group: Command surface
  code:
    - scanner: typescript
      file: src/plain-world.ts
      dependencies: 3
      dependents: 1
---

Prints the merged world or one selected element, plan, or owning Code record as stable plain text without starting a viewer.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World loader](../../core/components/world-loader.md) | Loads the merged architecture | In-process data |
