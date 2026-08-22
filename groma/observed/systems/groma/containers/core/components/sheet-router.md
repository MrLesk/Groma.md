---
id: sheet-router
kind: component
parent: core
group: World building
code:
  - scanner: typescript
    file: src/sheet/route.ts
    symbol: routeAll
---

# Sheet router

Routes one relationship at a time with A* on the quarter-cell lattice: out of the middle of the side of the source that faces the target into the middle of the side of the target that faces the source, pointing inward, one lane clear of every foreign building, on the one ground plane from end to end; a building's back side is hidden under its roof, so there a route starts or ends just behind the building where the roof's shadow ends and the line meets the middle of the roof's back edge. Later routes pay for lanes earlier routes use, so parallel routes fan out on their own.
