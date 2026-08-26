---
id: iso-projection
kind: component
parent: web-viewer
group: Map painting
code:
  - scanner: typescript
    file: src/viewers/web/iso/project.ts
    symbol: projectScene
    dependencies: 6
    dependents: 9
  - scanner: typescript
    file: src/viewers/web/iso/blueprint.ts
    dependencies: 5
    dependents: 2
---

# Iso projection

Projects the sheet into the 2:1 isometric picture: one centred piece for every visible source-file group, ordered as a nested largest-first tower, plus one polyline and arrowhead per route, surface text, and painter order back to front. Its blueprint domain adds the proportional frame, calibration ticks, compass, and project plate in the neutral map palette.
