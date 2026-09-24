---
type: C4 Component
title: Map highlighting
status: stable
groma:
  id: map-highlights
  parent: export
  group: Map drawing
  code:
    - scanner: typescript
      file: src/viewers/web/iso/highlights.ts
      symbol: createMapHighlights
description: Emphasises the current flow, task and neighbour components
---

Combines the current flow, task and component-neighbor highlights. Updates map emphasis while keeping navigation and the selected details intact.
