---
type: C4 Component
title: Web viewer hierarchy
status: stable
groma:
  id: web-viewer-hierarchy
  parent: web-viewer
  group: Web chrome
  code:
    - scanner: typescript
      file: src/viewers/web/organisms/hierarchy.ts
      symbol: paintHierarchy
      dependencies: 3
      dependents: 1
---

Paints the expandable architecture tree and keeps its selected path visible beside the map.
