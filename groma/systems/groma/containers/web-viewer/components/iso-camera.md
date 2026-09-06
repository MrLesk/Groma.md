---
type: C4 Component
title: Iso camera
status: stable
groma:
  id: iso-camera
  parent: web-viewer
  group: Blueprint map
  code:
    - scanner: typescript
      file: src/viewers/web/iso/camera.ts
    - scanner: typescript
      file: src/viewers/web/iso/pointer.ts
---

Owns fit, pan, zoom, resize, and pointer interaction as one camera transform without changing map geometry.
