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
---

Owns Web search entry shortcuts, query input, result cursor movement, accept and cancel events.
