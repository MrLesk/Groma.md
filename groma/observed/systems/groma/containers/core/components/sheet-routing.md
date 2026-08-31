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
      dependencies: 4
      dependents: 1
    - scanner: typescript
      file: src/sheet/route-geometry.ts
      dependencies: 3
      dependents: 3
    - scanner: typescript
      file: src/sheet/route-lanes.ts
      dependencies: 2
      dependents: 1
    - scanner: typescript
      file: src/sheet/route-spacing.ts
      dependencies: 1
      dependents: 2
---

Routes every authored relationship on one ground plane with deterministic ports, obstacle clearance, and separated orthogonal lanes.
