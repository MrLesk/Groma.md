---
id: iso-map
kind: component
parent: web-viewer
group: Map painting
code:
  - scanner: typescript
    file: src/viewers/web/iso/map.ts
    symbol: createMap
---

# Iso map

Owns the SVG: the patterns, the camera group and its layers, one group per island, slab, building, and route, and the class toggles for the selection, the surface it stands on, and lit flows, so nothing is repainted until the world changes.
