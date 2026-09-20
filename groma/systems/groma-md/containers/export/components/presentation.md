---
type: C4 Component
title: Map view motion
status: stable
groma:
  id: presentation
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/iso/presentation.ts
    - scanner: typescript
      file: src/viewers/web/layers/orbit.ts
  group: Map drawing
description: Animates transitions between browser map views
---

Moves smoothly between the isometric, 2D, and layer views. Keeps an interrupted transition at its current position.
