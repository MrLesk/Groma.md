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

Routes one relationship at a time with A* on the quarter-cell lattice: out of a free half-cell port, one lane clear of every foreign building, onto a container deck with one riser, into a side of the target the viewer can see. Later routes pay for lanes earlier routes use, so parallel routes fan out on their own.
