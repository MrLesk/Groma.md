---
type: C4 Component
title: Architecture search panel
status: stable
groma:
  id: search-control
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/search/control.ts
    - scanner: typescript
      file: src/viewers/web/search/model.ts
    - scanner: typescript
      file: src/viewers/web/search/session.ts
      symbol: createSearchSession
    - scanner: typescript
      file: src/viewers/web/search/view.ts
  group: Architecture panels
---

Searches architecture elements and tasks. Opens the selected result and restores the previous view when search closes.
