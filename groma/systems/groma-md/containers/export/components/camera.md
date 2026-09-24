---
type: C4 Component
title: Camera control
status: stable
groma:
  id: camera
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/iso/camera.ts
    - scanner: typescript
      file: src/viewers/web/iso/motion.ts
    - scanner: typescript
      file: src/viewers/web/iso/pointer.ts
    - scanner: typescript
      file: src/viewers/web/iso/camera-layer.ts
  group: Map drawing
description: Fits, pans and zooms the browser map camera
---

Fits, pans, and zooms the map. Handles pointer input and moves the camera with the view transition. Moves a cached picture of the map with the camera, draws a zoom-out's destination first, and rebuilds the picture sharp once the map settles.
