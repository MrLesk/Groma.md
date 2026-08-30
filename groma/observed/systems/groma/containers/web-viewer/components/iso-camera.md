---
id: iso-camera
kind: component
parent: web-viewer
group: "Blueprint map"
code:
  - scanner: typescript
    file: src/viewers/web/iso/camera.ts
    dependencies: 2
    dependents: 4
  - scanner: typescript
    file: src/viewers/web/iso/pointer.ts
    dependencies: 1
    dependents: 1
---

# Iso camera

Owns fit, pan, zoom, resize, and pointer interaction as one camera transform without changing map geometry.
