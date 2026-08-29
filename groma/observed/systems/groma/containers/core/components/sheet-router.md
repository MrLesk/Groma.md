---
id: sheet-router
kind: component
parent: core
group: World building
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

# Sheet router

Routes every authored relationship on one ground plane. Port direction comes from the geography of each endpoint's owning container, while concrete wall ports remain clear of complete height-swept building silhouettes. One Libavoid transaction finds all orthogonal paths together. A deterministic WebCola constraint pass then separates crowded parallel lanes without moving ports or accepting a building crossing or shared path. Routes attach to the visible wall, including the roof shadow on back sides, and round actors keep their ports balanced around the visual centre.
