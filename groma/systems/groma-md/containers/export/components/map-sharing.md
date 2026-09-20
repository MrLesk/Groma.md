---
type: C4 Component
title: Map sharing
status: stable
groma:
  id: map-sharing
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/sharing/cover.ts
    - scanner: typescript
      file: src/viewers/web/sharing/images.ts
    - scanner: typescript
      file: src/viewers/web/sharing/metadata.ts
  group: Browser session
description: Produces shareable map covers, PNG images and page metadata
---

Renders a cover SVG of the current map, turns it into theme-specific PNGs, and emits Open Graph metadata so a shared or exported page shows the architecture rather than a generic preview.
