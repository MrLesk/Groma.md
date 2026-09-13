---
type: C4 Component
title: Architecture editing
status: stable
groma:
  id: create
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/editing/create.ts
      symbol: createDialog
    - scanner: typescript
      file: src/viewers/web/editing/gestures.ts
    - scanner: typescript
      file: src/viewers/web/editing/intent.ts
    - scanner: typescript
      file: src/viewers/web/chrome/add.ts
    - scanner: typescript
      file: src/viewers/web/chrome/relate.ts
    - scanner: typescript
      file: src/viewers/web/organisms/remove.ts
    - scanner: typescript
      file: src/viewers/web/organisms/writes.ts
    - scanner: typescript
      file: src/viewers/web/organisms/tip.ts
    - scanner: typescript
      file: src/viewers/web/project/editor.ts
  group: Architecture panels
---

Turns map gestures and forms into architecture write actions. Supports new drafts, groups, relationships, acceptance, and removal.
