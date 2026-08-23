---
id: sheet
kind: component
parent: core
group: World building
code:
  - scanner: typescript
    file: src/sheet/scene.ts
    symbol: sheetScene
---

# Sheet

Composes the web map's blueprint sheet from the merged world: flat islands for actors, external systems, and each internal system, container slabs level with their island, buildings sized for their names and raised by their code, group zones, all snapped to whole grid cells, and one lattice route per authored relationship. Inside every surface what the outside feeds stands in a west column and every other child, the heaviest first, takes the cheapest spot beside the siblings it talks to, arrows priced by length, bends and whatever stands in their way, so routes stay short and straight. The same world always gives the same sheet.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Sheet router](sheet-router.md) | Routes every relationship on the quarter-cell lattice | In-process data |
