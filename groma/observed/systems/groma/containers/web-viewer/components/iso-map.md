---
id: iso-map
kind: component
parent: web-viewer
group: Map painting
code:
  - scanner: typescript
    file: src/viewers/web/iso/map.ts
    symbol: createMap
    dependencies: 9
    dependents: 1
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
    dependencies: 2
    dependents: 1
  - scanner: typescript
    file: src/viewers/web/iso/scale.ts
    dependencies: 1
    dependents: 2
  - scanner: typescript
    file: src/viewers/web/iso/style.ts
    dependencies: 2
    dependents: 3
  - scanner: typescript
    file: src/viewers/web/iso/svg.ts
    dependencies: 1
    dependents: 5
  - scanner: typescript
    file: src/viewers/web/iso/text.ts
    symbol: surfaceText
    dependencies: 3
    dependents: 2
---

# Iso map

Owns the SVG map: drafting decorations, the camera and layers, architecture surfaces, compressed file-floor buildings, routes, and interaction state. Every measured component floor receives a deterministic facade-window pattern from its largest member's normalized file extension, so an unknown type needs no registry; roofs remain plain and readable.
