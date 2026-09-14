---
type: C4 Component
title: Browser session
status: stable
groma:
  id: render
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/render.ts
    - scanner: typescript
      file: src/viewers/web/selection.ts
    - scanner: typescript
      file: src/viewers/web/url.ts
  group: Browser session
---

Connects browser controls to the current architecture and task state. Updates the selection and page address when the map changes.
