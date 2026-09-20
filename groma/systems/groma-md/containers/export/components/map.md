---
type: C4 Component
title: Map painting
status: stable
groma:
  id: map
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/iso/map.ts
    - scanner: typescript
      file: src/viewers/web/iso/paint-buildings.ts
    - scanner: typescript
      file: src/viewers/web/iso/paint-ground.ts
    - scanner: typescript
      file: src/viewers/web/iso/paint-routes.ts
      symbol: routesSvg
    - scanner: typescript
      file: src/viewers/web/iso/style.ts
    - scanner: typescript
      file: src/viewers/web/iso/svg.ts
    - scanner: typescript
      file: src/viewers/web/iso/text.ts
    - scanner: typescript
      file: src/viewers/web/iso/scale.ts
    - scanner: typescript
      file: src/viewers/web/layers/paint.ts
  group: Map drawing
---

Draws the map surfaces, buildings, labels, and connections as SVG. Applies selection and task emphasis.
