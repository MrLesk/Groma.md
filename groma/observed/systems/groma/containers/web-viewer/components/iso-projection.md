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

Projects the sheet into the 2:1 isometric picture: side faces for every file section, visible intermediate roofs for short stepped stacks, only the final roof for aligned towers, one polyline and arrowhead per route, surface text, and painter order back to front. Its blueprint domain adds the proportional frame, calibration ticks, compass, and project plate in the neutral map palette.
