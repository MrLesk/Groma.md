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
      dependencies: 6
      dependents: 15
    - scanner: typescript
      file: src/viewers/tui/projection-camera.ts
      dependencies: 1
      dependents: 4
    - scanner: typescript
      file: src/viewers/tui/projection-routes.ts
      symbol: routeBetween
      dependencies: 1
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/projection-root.ts
      symbol: rootLayout
      dependencies: 5
      dependents: 6
    - scanner: typescript
      file: src/viewers/tui/projection-container.ts
      dependencies: 5
      dependents: 2
---

Builds the fixed-scale terminal map from the shared sheet: root islands with container rows, and container views with grouped component buildings and neighbouring previews. It routes visible connections, keeps world geometry stable across selection, centers a root that fits, and bounds camera movement around the displayed map.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Sheet composition](../../core/components/sheet-composition.md) | Uses the fixed shared surfaces and routes | In-process data |
