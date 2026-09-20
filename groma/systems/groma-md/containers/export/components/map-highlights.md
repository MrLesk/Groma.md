---
type: C4 Component
title: Map highlighting
status: stable
groma:
  id: map-highlights
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/map-highlights.ts
      symbol: createMapHighlights
  group: Map drawing
---

Combines the current flow, task and component-neighbor highlights. Updates map emphasis while keeping navigation and the selected details intact.
