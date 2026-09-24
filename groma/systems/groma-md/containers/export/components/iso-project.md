---
type: C4 Component
title: Map projection
status: stable
groma:
  id: iso-project
  parent: export
  group: Map drawing
  code:
    - scanner: typescript
      file: src/viewers/web/iso/projection/project.ts
    - scanner: typescript
      file: src/viewers/web/iso/projection/blueprint.ts
    - scanner: typescript
      file: src/viewers/web/iso/projection/separation.ts
description: Projects the layout into isometric, 2D and layer views
---

Converts the flat layout into isometric, 2D, and layer views. Separates the architecture layers without changing the stored model.
