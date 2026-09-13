---
type: C4 Component
title: Source panel
status: stable
groma:
  id: source-control
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/source/control.ts
    - scanner: typescript
      file: src/viewers/web/source/view.ts
    - scanner: typescript
      file: src/viewers/web/source/highlight.ts
  group: Architecture panels
---

Shows the source file selected from component details. Highlights its syntax and requested source lines.
