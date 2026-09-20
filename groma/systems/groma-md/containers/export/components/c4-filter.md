---
type: C4 Component
title: Map filters
status: stable
groma:
  id: c4-filter
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/chrome/c4-filter.ts
  group: Browser controls
description: Shows or hides C4 kinds on the browser map without changing records
---

Selects which C4 element kinds appear in the browser map. Applies the selection to the displayed scene without changing the stored architecture.
