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
      dependencies: 5
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
      dependents: 2
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
  group: Web runtime
---

Owns the browser controls for adding architecture, editing meaning, grouping or combining components, connecting selected elements, accepting matched drafts and removing eligible records. It collects each input and submits the shared authoring operation through the live data source; historical and static views do not offer writes.
