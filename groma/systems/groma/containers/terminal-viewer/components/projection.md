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
      dependencies: 5
      dependents: 12
    - scanner: typescript
      file: src/viewers/tui/projection-camera.ts
      dependencies: 1
      dependents: 4
    - scanner: typescript
      file: src/viewers/tui/projection-routes.ts
      dependencies: 1
      dependents: 1
---

Projects the shared sheet into fixed-scale terminal cells and moves only the camera needed to keep the selected item visible.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Sheet composition](../../core/components/sheet-composition.md) | Uses the fixed shared surfaces and routes | In-process data |
