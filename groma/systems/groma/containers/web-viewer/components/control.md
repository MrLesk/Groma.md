---
type: C4 Component
title: Control
status: stable
groma:
  id: control
  parent: web-viewer
  group: Search
  code:
    - scanner: typescript
      file: src/viewers/web/search/control.ts
      dependencies: 3
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/search/model.ts
      dependencies: 2
      dependents: 2
---

Owns the permanent Web search entry, shortcuts, query and cursor. Ranks core architecture matches together with task IDs and titles supplied by the optional work-source plugin. Query changes leave results unselected and the camera still; arrow navigation previews a result, and Enter or a click accepts through the search session.
