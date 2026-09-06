---
type: C4 Component
title: Iso map
status: stable
groma:
  id: iso-map
  parent: web-viewer
  group: Blueprint map
  code:
    - scanner: typescript
      file: src/viewers/web/iso/map.ts
    - scanner: typescript
      file: src/viewers/web/iso/paint-buildings.ts
      symbol: paintBuildings
    - scanner: typescript
      file: src/viewers/web/iso/paint-ground.ts
    - scanner: typescript
      file: src/viewers/web/iso/paint-routes.ts
    - scanner: typescript
      file: src/viewers/web/iso/scale.ts
    - scanner: typescript
      file: src/viewers/web/iso/style.ts
    - scanner: typescript
      file: src/viewers/web/iso/svg.ts
    - scanner: typescript
      file: src/viewers/web/iso/text.ts
      symbol: surfaceText
---

Owns the SVG blueprint surface: architecture ground, file-floor buildings, routes, labels, deterministic facade patterns, and map styling.
