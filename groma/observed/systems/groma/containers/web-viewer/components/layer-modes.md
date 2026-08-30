---
id: layer-modes
kind: component
parent: web-viewer
group: "Blueprint map"
code:
  - scanner: typescript
    file: src/viewers/web/layers/orbit.ts
    dependencies: 1
    dependents: 1
  - scanner: typescript
    file: src/viewers/web/layers/separation.ts
    dependencies: 2
    dependents: 4
  - scanner: typescript
    file: src/viewers/web/layers/paint.ts
    dependencies: 2
    dependents: 2
---

# Layer modes

Keeps orbit, separation, and layer-paint projections as explicit views of the same immutable architecture scene.
