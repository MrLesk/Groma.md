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
  group: Map drawing
description: Fits, pans and zooms the browser map camera
---

Fits, pans, and zooms the map. Handles pointer input and moves the camera with the view transition.
