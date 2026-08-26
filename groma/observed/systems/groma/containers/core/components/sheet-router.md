---
id: sheet-router
kind: component
parent: core
group: World building
code:
  - scanner: typescript
    file: src/sheet/route.ts
    symbol: routeAll
    dependencies: 5
    dependents: 1
  - scanner: typescript
    file: src/sheet/port-layout.ts
    dependencies: 1
    dependents: 1
---

# Sheet router

Chooses obstacle-aware sides first, then produces concrete source and target port pairs before route repulsion shapes the path between them. A component route attaches to its actual ground-floor footprint while foreign routes avoid the complete tower envelope. One route on a round actor side uses its exact visual centre; routes sharing that side use distinct ports balanced around it. A single target arrival also prefers the middle of its chosen side, then tries ports centre-out if that complete route is blocked; an already straight connection between aligned elements stays straight. Route cost checks each concrete pair but never chooses between ports. A* then routes one relationship at a time on the quarter-cell lattice, with fixed straight departures and arrivals, no immediate reversal, retracing, or return through the one-cell departure area, one lane clear of every foreign building, and one ground plane from end to end. A building's back side is hidden under its roof, so its port appears where the roof shadow ends. When another building crowds the source's most direct departure, clear sides compete equally and an alternate departure runs a full cell before its first bend. Later route bodies repel without moving the selected ports. Routes also avoid grazing buildings, tracing surface borders, or crowding neighbouring routes.
