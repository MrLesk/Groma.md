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
      dependencies: 6
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/chrome/add.ts
      dependencies: 1
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/chrome/group.ts
      symbol: createGroupDialog
      dependencies: 2
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/chrome/relate.ts
      dependencies: 1
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/organisms/writes.ts
      dependencies: 3
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/organisms/editable.ts
      dependencies: 0
      dependents: 3
    - scanner: typescript
      file: src/viewers/web/organisms/remove.ts
      dependencies: 0
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/editing/intent.ts
      dependencies: 1
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/editing/create.ts
      symbol: createDialog
      dependencies: 2
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/editing/gestures.ts
      dependencies: 7
      dependents: 2
  group: Web runtime
---

Owns live map editing: drag controls create draft software in a chosen parent, a drawn boundary chooses sibling group members, and a directed drag plans a relationship. Explicit details forms collect changed meaning with Save, Cancel and shared core validation. Gestures submit IDs and authored meaning through the live data source; core computes all positions, group boundaries and routes. Historical and static maps expose no writes.
