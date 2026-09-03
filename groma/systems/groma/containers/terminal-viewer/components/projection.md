---
type: C4 Component
title: Projection
status: stable
groma:
  id: projection
  parent: terminal-viewer
  code:
    - scanner: typescript
      file: src/viewers/tui/projection.ts
      dependencies: 7
      dependents: 15
    - scanner: typescript
      file: src/viewers/tui/projection-camera.ts
      dependencies: 1
      dependents: 4
    - scanner: typescript
      file: src/viewers/tui/projection-routes.ts
      symbol: attachRoute
      dependencies: 1
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/projection-sheet.ts
      dependencies: 3
      dependents: 3
    - scanner: typescript
      file: src/viewers/tui/projection-root.ts
      symbol: rootLayout
      dependencies: 3
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/projection-container.ts
      dependencies: 4
      dependents: 2
---

Projects the shared sheet into fixed-scale terminal cells and moves only the camera needed to keep the selected item visible.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Sheet composition](../../core/components/sheet-composition.md) | Uses the fixed shared surfaces and routes | In-process data |
