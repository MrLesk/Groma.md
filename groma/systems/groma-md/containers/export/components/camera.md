---
type: C4 Component
title: Camera control
status: stable
groma:
  id: camera
  parent: export
  group: Map drawing
  code:
    - scanner: typescript
      file: src/viewers/web/iso/camera/camera.ts
    - scanner: typescript
      file: src/viewers/web/iso/camera/motion.ts
    - scanner: typescript
      file: src/viewers/web/iso/camera/pointer.ts
    - scanner: typescript
      file: src/viewers/web/iso/camera/layer.ts
description: Fits, pans and zooms the browser map camera
---

Fits, pans, and zooms the map. Handles pointer input and moves the camera with the view transition. Moves a cached picture of the map with the camera, draws a zoom-out's destination first, and rebuilds the picture sharp once the map settles.
