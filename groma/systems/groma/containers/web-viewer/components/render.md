---
type: C4 Component
title: Render
status: stable
groma:
  id: render
  parent: web-viewer
  group: Web runtime
  code:
    - scanner: typescript
      file: src/viewers/web/render.ts
    - scanner: typescript
      file: src/viewers/web/selection.ts
    - scanner: typescript
      file: src/viewers/web/url.ts
    - scanner: typescript
      file: src/viewers/web/data.ts
---

Owns browser selection and orchestration: paints the map, hierarchy and details, applies live payloads, and keeps URL state synchronized without changing sheet geometry.
