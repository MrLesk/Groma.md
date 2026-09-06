---
type: C4 Component
title: Layer modes
status: stable
groma:
  id: layer-modes
  parent: web-viewer
  group: Blueprint map
  code:
    - scanner: typescript
      file: src/viewers/web/layers/orbit.ts
    - scanner: typescript
      file: src/viewers/web/layers/separation.ts
    - scanner: typescript
      file: src/viewers/web/layers/paint.ts
---

Keeps orbit, separation, and layer-paint projections as explicit views of the same immutable architecture scene.
