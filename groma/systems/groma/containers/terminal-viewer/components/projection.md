---
type: C4 Component
title: Projection
status: stable
groma:
  id: projection
  parent: terminal-viewer
  code:
    - scanner: typescript
      file: src/viewers/tui/projection.ts
    - scanner: typescript
      file: src/viewers/tui/projection-camera.ts
    - scanner: typescript
      file: src/viewers/tui/projection-routes.ts
      symbol: routeBetween
    - scanner: typescript
      file: src/viewers/tui/projection-root.ts
      symbol: rootLayout
    - scanner: typescript
      file: src/viewers/tui/projection-container.ts
---

Builds the fixed-scale terminal map from the shared sheet: root islands with container rows, and container views with grouped component buildings and neighbouring previews. It routes visible connections, keeps world geometry stable across selection, centers a root that fits, and bounds camera movement around the displayed map.
