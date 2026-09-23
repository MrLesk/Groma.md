---
type: C4 Component
title: Map connections
status: stable
groma:
  id: relationships
  parent: cli
  group: Map layout
  code:
    - scanner: typescript
      file: src/sheet/route/route.ts
      symbol: routeAll
    - scanner: typescript
      file: src/sheet/route/checks.ts
    - scanner: typescript
      file: src/sheet/route/costs.ts
    - scanner: typescript
      file: src/sheet/route/finish.ts
    - scanner: typescript
      file: src/sheet/route/geometry.ts
    - scanner: typescript
      file: src/sheet/route/graph.ts
    - scanner: typescript
      file: src/sheet/route/nudge.ts
    - scanner: typescript
      file: src/sheet/route/order.ts
    - scanner: typescript
      file: src/sheet/route/paths.ts
      symbol: RoutePaths
    - scanner: typescript
      file: src/sheet/route/ports.ts
    - scanner: typescript
      file: src/sheet/route/queue.ts
      symbol: SearchQueue
    - scanner: typescript
      file: src/sheet/route/relationships.ts
      symbol: mapRelationships
    - scanner: typescript
      file: src/sheet/route/space.ts
description: Routes the connections between placed map elements
---

Selects the relationships that the map must display. Allocates connection space and routes the lines around buildings.
