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
      dependencies: 2
      dependents: 5
    - scanner: typescript
      file: src/viewers/web/iso/pointer.ts
      dependencies: 1
      dependents: 1
---

Owns fit, pan, zoom, resize, and pointer interaction as one camera transform without changing map geometry.
