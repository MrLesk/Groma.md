---
type: C4 Component
title: Map fonts
status: stable
groma:
  id: fonts-index
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/atoms/fonts/index.ts
  group: Map drawing
description: Embeds the fonts used by the live map and generated cover images
---

Ships DejaVu faces with the application so the browser page and in-process PNG renderer draw the same type without searching the host.
