---
type: C4 Component
title: Iso projection
status: stable
groma:
  id: iso-projection
  parent: web-viewer
  group: Blueprint map
  code:
    - scanner: typescript
      file: src/viewers/web/iso/project.ts
    - scanner: typescript
      file: src/viewers/web/iso/blueprint.ts
---

Projects the shared sheet into one ordered 2:1 isometric scene with blueprint frame, title plate, surfaces, buildings, and routes.
