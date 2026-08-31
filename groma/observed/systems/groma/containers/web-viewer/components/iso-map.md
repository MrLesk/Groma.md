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
      dependencies: 12
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/iso/paint-buildings.ts
      symbol: paintBuildings
      dependencies: 6
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/iso/paint-ground.ts
      dependencies: 5
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/iso/paint-routes.ts
      dependencies: 3
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/iso/scale.ts
      dependencies: 0
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/iso/style.ts
      dependencies: 3
      dependents: 3
    - scanner: typescript
      file: src/viewers/web/iso/svg.ts
      dependencies: 1
      dependents: 6
    - scanner: typescript
      file: src/viewers/web/iso/text.ts
      symbol: surfaceText
      dependencies: 3
      dependents: 2
---

Owns the SVG blueprint surface: architecture ground, file-floor buildings, routes, labels, deterministic facade patterns, and map styling.
