---
id: iso-projection
kind: component
parent: web-viewer
group: Map painting
code:
  - scanner: typescript
    file: src/viewers/web/iso/project.ts
    symbol: projectScene
  - scanner: typescript
    file: src/viewers/web/iso/blueprint.ts
    symbol: projectBlueprint
---

# Iso projection

Projects the sheet into the 2:1 isometric picture: three faces per box tier, one polyline and arrowhead per route, the plane each name lies on, and the painter order back to front. Its blueprint domain adds one proportional frame, unlabeled calibration ticks on its two front edges, a scaled compass, and—when a project profile exists—rendered project Markdown, title metadata, and a ground-plane pencil in an east-aligned plate. The plate fits lines up to an 80-character measure; content beyond it wraps and pushes only the south frame edge outward. Every added decoration uses the neutral map palette.
