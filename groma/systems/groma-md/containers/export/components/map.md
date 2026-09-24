---
type: C4 Component
title: Map painting
status: stable
groma:
  id: map
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/iso/painting/map.ts
    - scanner: typescript
      file: src/viewers/web/iso/painting/buildings.ts
    - scanner: typescript
      file: src/viewers/web/iso/painting/ground.ts
    - scanner: typescript
      file: src/viewers/web/iso/painting/routes.ts
      symbol: routesSvg
    - scanner: typescript
      file: src/viewers/web/iso/painting/style.ts
    - scanner: typescript
      file: src/viewers/web/iso/painting/svg.ts
    - scanner: typescript
      file: src/viewers/web/iso/painting/text.ts
    - scanner: typescript
      file: src/viewers/web/iso/painting/scale.ts
    - scanner: typescript
      file: src/viewers/web/iso/painting/glow.ts
    - scanner: typescript
      file: src/viewers/web/iso/painting/layer-planes.ts
  group: Map drawing
description: Paints the browser map as SVG buildings, routes and labels
---

Draws the map surfaces, buildings, labels, and connections as SVG. Applies selection and task emphasis.
