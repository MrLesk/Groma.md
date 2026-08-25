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

Owns the SVG: drafting decorations, patterns, the camera group and its layers, one group per island, slab, building, and route, and the class toggles for selection, context, and lit flows. It also exposes the title plate's pencil hit without making the rest of the sheet interactive, and repaints only when the world changes.
