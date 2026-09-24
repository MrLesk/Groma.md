---
type: C4 Component
title: Map view motion
status: stable
groma:
  id: presentation
  parent: export
  group: Map drawing
  code:
    - scanner: typescript
      file: src/viewers/web/iso/view-motion/presentation.ts
    - scanner: typescript
      file: src/viewers/web/iso/view-motion/orbit.ts
    - scanner: typescript
      file: src/viewers/web/iso/view-motion/morph.ts
description: Animates transitions between browser map views
---

Moves smoothly between the isometric, 2D, and layer views. Keeps an interrupted transition at its current position.
