---
type: C4 Component
title: Terminal painting
status: stable
groma:
  id: terminal-painting
  parent: terminal-viewer
  group: Terminal presentation
  code:
    - scanner: typescript
      file: src/viewers/tui/paint.ts
      symbol: paintMap
      dependencies: 10
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/atoms/border.ts
      dependencies: 2
      dependents: 2
    - scanner: typescript
      file: src/viewers/tui/atoms/cell.ts
      symbol: cell
      dependencies: 0
      dependents: 2
    - scanner: typescript
      file: src/viewers/tui/molecules/flow-marker.ts
      symbol: drawFlowMarker
      dependencies: 3
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/atoms/theme.ts
      dependencies: 2
      dependents: 19
    - scanner: typescript
      file: src/viewers/tui/atoms/text.ts
      symbol: text
      dependencies: 0
      dependents: 8
    - scanner: typescript
      file: src/viewers/tui/atoms/visible.ts
      symbol: visible
      dependencies: 1
      dependents: 0
    - scanner: typescript
      file: src/viewers/tui/molecules/route.ts
      dependencies: 6
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/organisms/world.ts
      symbol: drawWorld
      dependencies: 11
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/molecules/building.ts
      symbol: drawBuilding
      dependencies: 5
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/molecules/row.ts
      symbol: drawRow
      dependencies: 4
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/molecules/surface.ts
      dependencies: 6
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/molecules/work-marker.ts
      symbol: drawWorkCorner
      dependencies: 5
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/organisms/empty.ts
      symbol: drawEmptyWorld
      dependencies: 3
      dependents: 1
---

Paints the projected terminal map as islands, container rows, component buildings, source floors, routes and task markers. Explicit flow or task state controls connection emphasis; ordinary map selection does not. It also paints the invitation when the architecture is empty.
