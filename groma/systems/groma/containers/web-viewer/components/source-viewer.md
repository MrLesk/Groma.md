---
type: C4 Component
title: Source viewer
status: stable
groma:
  id: source-viewer
  parent: web-viewer
  code:
    - scanner: typescript
      file: src/viewers/web/source/control.ts
    - scanner: typescript
      file: src/viewers/web/source/view.ts
    - scanner: typescript
      file: src/viewers/web/source/highlight.ts
    - scanner: typescript
      file: src/viewers/web/organisms/code-lists.ts
---

Controls browser source inspection and renders owned file lists, declarations and highlighted code inside Details. Opening code keeps the architecture selection and uses the shared source readers and syntax tokens.
