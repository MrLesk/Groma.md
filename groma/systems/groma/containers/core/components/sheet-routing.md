---
type: C4 Component
title: Sheet routing
status: stable
groma:
  id: sheet-routing
  parent: core
  group: Sheet
  code:
    - scanner: typescript
      file: src/sheet/route.ts
      symbol: routeAll
    - scanner: typescript
      file: src/sheet/route-geometry.ts
    - scanner: typescript
      file: src/sheet/route-spacing.ts
    - scanner: typescript
      file: src/sheet/route-grid.ts
    - scanner: typescript
      file: src/sheet/route-search.ts
      symbol: RouteSearch
    - scanner: typescript
      file: src/sheet/route-finish.ts
---

Routes every visible relationship on one ground plane with deterministic ports, obstacle clearance, and distinct orthogonal paths.
