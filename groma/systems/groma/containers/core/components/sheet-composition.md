---
type: C4 Component
title: Sheet composition
status: stable
groma:
  id: sheet-composition
  parent: core
  group: Sheet
  code:
    - scanner: typescript
      file: src/sheet/compose.ts
      dependencies: 3
      dependents: 1
    - scanner: typescript
      file: src/sheet/forces.ts
      dependencies: 0
      dependents: 3
    - scanner: typescript
      file: src/sheet/grid.ts
      dependencies: 2
      dependents: 4
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
      dependencies: 9
      dependents: 2
    - scanner: typescript
      file: src/sheet/rank.ts
      symbol: flowRanks
      dependencies: 0
      dependents: 1
    - scanner: typescript
      file: src/sheet/scene.ts
      dependencies: 4
      dependents: 2
    - scanner: typescript
      file: src/sheet/types.ts
      dependencies: 1
      dependents: 15
---

Composes the semantic graph into one deterministic shared sheet: slabs, groups, component buildings, source-file floors, placement, and route inputs.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Sheet routing](sheet-routing.md) | Routes every authored collaboration | In-process data |
