---
id: sheet
kind: component
parent: core
group: World building
code:
  - scanner: typescript
    file: src/sheet/scene.ts
    symbol: sheetScene
    dependencies: 4
    dependents: 3
  - scanner: typescript
    file: src/sheet/compose.ts
    symbol: composePlacement
    dependencies: 3
    dependents: 1
  - scanner: typescript
    file: src/sheet/forces.ts
    dependencies: 0
    dependents: 4
  - scanner: typescript
    file: src/sheet/grid.ts
    dependencies: 2
    dependents: 7
  - scanner: typescript
    file: src/sheet/measure.ts
    dependencies: 2
    dependents: 8
  - scanner: typescript
    file: src/sheet/pack.ts
    dependencies: 3
    dependents: 1
  - scanner: typescript
    file: src/sheet/place.ts
    dependencies: 8
    dependents: 2
  - scanner: typescript
    file: src/sheet/rank.ts
    symbol: flowRanks
    dependencies: 0
    dependents: 1
  - scanner: typescript
    file: src/sheet/types.ts
    dependencies: 1
    dependents: 13
---

# Sheet

Composes the viewers' shared blueprint sheet from the semantic architecture graph. Leaf relationships form a weighted container flow: actor-facing entries remain west, mediator containers bridge the flow, and its strongest internal sink becomes the east core. Complete slabs, zones, and buildings move together, with extra ground opened only where routes need it. The sheet also holds flat architecture surfaces, group zones, one route per authored relationship, and component buildings compressed to one through five visible floors by their project-relative source-file count. Every unique file belongs to one group. Each group takes the maximum member LOC, dependent, and dependency measurements, then floors are ordered largest-first and nested so upper floors never overhang lower ones. Semantic identity orders siblings, and coordinates from another layout are never consulted.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Sheet router](sheet-router.md) | Routes every relationship in one obstacle-aware orthogonal pass | In-process data |
