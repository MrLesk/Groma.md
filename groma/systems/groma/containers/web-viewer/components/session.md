---
type: C4 Component
title: Session
status: stable
groma:
  id: session
  parent: web-viewer
  group: Search
  code:
    - scanner: typescript
      file: src/viewers/web/search/session.ts
      symbol: createSearchSession
---

Saves selection, details tab and camera when search opens. Previews architecture or a task’s mapped elements without committing selection; cancel restores the saved view, while task acceptance uses the shared task-opening action.
