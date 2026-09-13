---
type: C4 Component
title: Terminal projection
status: stable
groma:
  id: projection
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/tui/projection.ts
    - scanner: typescript
      file: src/viewers/tui/projection-root.ts
    - scanner: typescript
      file: src/viewers/tui/projection-container.ts
    - scanner: typescript
      file: src/viewers/tui/projection-camera.ts
    - scanner: typescript
      file: src/viewers/tui/projection-routes.ts
      symbol: routeBetween
    - scanner: typescript
      file: src/viewers/tui/layout.ts
  group: Terminal map
---

Converts the shared architecture layout into terminal rows and cells. Selects the visible buildings and routes for the current view.
