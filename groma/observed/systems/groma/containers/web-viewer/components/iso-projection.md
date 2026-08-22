---
id: iso-projection
kind: component
parent: web-viewer
group: Map painting
code:
  - scanner: typescript
    file: src/viewers/web/iso/project.ts
    symbol: projectScene
---

# Iso projection

Projects the sheet into the 2:1 isometric picture: three faces per box tier, a polyline and arrowhead per route, the plane each name lies on, the painter order back to front, and the bounds the camera fits.
