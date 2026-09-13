---
type: C4 Component
title: Map projection
status: stable
groma:
  id: iso-project
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/iso/project.ts
    - scanner: typescript
      file: src/viewers/web/iso/blueprint.ts
    - scanner: typescript
      file: src/viewers/web/layers/separation.ts
  group: Map drawing
---

Converts the flat layout into isometric, 2D, and layer views. Separates the architecture layers without changing the stored model.
