---
type: C4 Component
title: Layer geometry
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

Computes orbit poses and separated layer projections, and paints layer planes and labels from the same immutable architecture scene. Map presentation owns view selection and animation scheduling.
