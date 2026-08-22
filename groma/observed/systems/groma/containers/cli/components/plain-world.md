---
id: plain-world
kind: component
parent: cli
code:
  - scanner: typescript
    file: src/plain-world.ts
    symbol: formatPlainWorld
---

# Plain text view

What `groma view --plain` prints: the merged world as indented text, every element with its kind, origin and relationships. `groma view <id>` prints one record the same way, and any host without a terminal gets this view instead of the map.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World loader](../../core/components/world-loader.md) | Loads the merged world | In-process data |
