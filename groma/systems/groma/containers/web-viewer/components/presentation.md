---
type: C4 Component
title: Map presentation
status: stable
groma:
  id: presentation
  parent: web-viewer
  code:
    - scanner: typescript
      file: src/viewers/web/iso/presentation.ts
      symbol: presentScene
---

Owns selection and animation of Iso, 2D and Layers views, then projects the shared architecture scene for the selected presentation. Repeated selection of the current view preserves the camera.
