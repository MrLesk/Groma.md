---
type: C4 Component
title: World layout
status: stable
groma:
  id: world-layout
  parent: core
  group: Architecture world
  code:
    - scanner: typescript
      file: src/world-layout.ts
      symbol: layoutArchitectureWorld
      dependencies: 1
      dependents: 1
---

Adds containment bounds, group boundaries, and orthogonal routes to the semantic graph for the fixed-scale terminal map.
