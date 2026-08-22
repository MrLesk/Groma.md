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

Composes the web map's blueprint sheet from the merged world: flat islands for people, external systems, and each internal system, container slabs, buildings sized for their names and raised by their code, group zones, all snapped to whole grid cells, and one lattice route per authored relationship. The same world always gives the same sheet.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Sheet router](sheet-router.md) | Routes every relationship on the quarter-cell lattice | In-process data |
