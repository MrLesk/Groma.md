---
type: C4 Component
title: Map placement
status: stable
groma:
  id: scene
  parent: cli
  code:
    - scanner: typescript
      file: src/sheet/scene.ts
    - scanner: typescript
      file: src/sheet/place.ts
    - scanner: typescript
      file: src/sheet/pack.ts
    - scanner: typescript
      file: src/sheet/pack-paths.ts
      symbol: PackingPaths
    - scanner: typescript
      file: src/sheet/rank.ts
      symbol: flowRanks
    - scanner: typescript
      file: src/sheet/compose.ts
    - scanner: typescript
      file: src/sheet/measure.ts
    - scanner: typescript
      file: src/sheet/grid.ts
    - scanner: typescript
      file: src/sheet/forces.ts
    - scanner: typescript
      file: src/sheet/types.ts
  group: Map layout
description: Places systems, containers, groups and components on the shared map sheet
---

Measures and places systems, containers, groups, and components. Reserves space for the connections before it places the map.
