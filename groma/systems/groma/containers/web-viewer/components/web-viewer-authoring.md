---
type: C4 Component
title: Architecture editing
status: stable
groma:
  id: web-viewer-authoring
  parent: web-viewer
  code:
    - scanner: typescript
      file: src/viewers/web/authoring.ts
    - scanner: typescript
      file: src/viewers/web/chrome/add.ts
    - scanner: typescript
      file: src/viewers/web/chrome/relate.ts
    - scanner: typescript
      file: src/viewers/web/organisms/writes.ts
    - scanner: typescript
      file: src/viewers/web/organisms/editable.ts
    - scanner: typescript
      file: src/viewers/web/organisms/remove.ts
    - scanner: typescript
      file: src/viewers/web/editing/intent.ts
    - scanner: typescript
      file: src/viewers/web/editing/create.ts
      symbol: createDialog
    - scanner: typescript
      file: src/viewers/web/editing/gestures.ts
  group: Web runtime
---

Owns live map editing: drag controls create draft software in a chosen parent, a drawn boundary chooses sibling group members, and a directed drag plans a relationship. Explicit details forms collect changed meaning with Save, Cancel and shared core validation. Gestures submit IDs and authored meaning through the live data source; core computes all positions, group boundaries and routes. Historical and static maps expose no writes.
