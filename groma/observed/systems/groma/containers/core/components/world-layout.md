---
id: world-layout
kind: component
parent: core
group: World building
code:
  - scanner: typescript
    file: src/world-layout.ts
    symbol: layoutArchitectureWorld
---

# World layout

Lays the whole world out once for the terminal map: containment boxes, group boundaries, and orthogonal routes, with one stable id per relationship that every viewer shares.

## Technology

ELK layered layout, run in a worker.
