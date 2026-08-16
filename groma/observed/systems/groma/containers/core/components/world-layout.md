---
id: world-layout
kind: component
parent: core
group: World building
code:
  - scanner: typescript
    file: src/world-layout.ts
    symbol: layoutArchitectureWorld
---

# World layout

Positions every element from containment and relationships, then routes directed arrows. It returns that geometry as renderer-independent objects.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Map](../../terminal-viewer/components/map.md) | Supplies fixed positions and routes | In-process data |
| [Web map](../../web-viewer/components/web-map.md) | Supplies fixed positions and routes | In-process data |
