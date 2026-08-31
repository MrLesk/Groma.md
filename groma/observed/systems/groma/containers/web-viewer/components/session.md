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
      dependencies: 6
      dependents: 1
---

Keeps search preview temporary by saving the current selection, details tab, and camera; reveals ranked elements without committing them and restores the saved view on cancel.
