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
    - scanner: typescript
      file: src/sheet/forces.ts
    - scanner: typescript
      file: src/sheet/grid.ts
    - scanner: typescript
      file: src/sheet/measure.ts
    - scanner: typescript
      file: src/sheet/pack.ts
    - scanner: typescript
      file: src/sheet/place.ts
    - scanner: typescript
      file: src/sheet/rank.ts
      symbol: flowRanks
    - scanner: typescript
      file: src/sheet/scene.ts
    - scanner: typescript
      file: src/sheet/types.ts
    - scanner: typescript
      file: src/sheet/relationships.ts
      symbol: mapRelationships
    - scanner: typescript
      file: src/sheet/pack-paths.ts
      symbol: PackingPaths
---

Composes the semantic graph into one deterministic shared sheet: slabs, groups, component buildings, source-file floors, placement, and route inputs.
