---
type: C4 Component
title: Map connections
status: stable
groma:
  id: relationships
  parent: cli
  code:
    - scanner: typescript
      file: src/sheet/relationships.ts
      symbol: mapRelationships
    - scanner: typescript
      file: src/sheet/route-space.ts
    - scanner: typescript
      file: src/sheet/route.ts
      symbol: routeAll
    - scanner: typescript
      file: src/sheet/route-grid.ts
    - scanner: typescript
      file: src/sheet/route-search.ts
      symbol: RouteSearch
    - scanner: typescript
      file: src/sheet/route-geometry.ts
    - scanner: typescript
      file: src/sheet/route-finish.ts
    - scanner: typescript
      file: src/sheet/route-spacing.ts
  group: Map layout
description: Routes the connections between placed map elements
---

Selects the relationships that the map must display. Allocates connection space and routes the lines around buildings.
