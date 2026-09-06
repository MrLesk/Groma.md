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
    - scanner: typescript
      file: src/viewers/tui/atoms/border.ts
    - scanner: typescript
      file: src/viewers/tui/atoms/cell.ts
      symbol: cell
    - scanner: typescript
      file: src/viewers/tui/molecules/flow-marker.ts
      symbol: drawFlowMarker
    - scanner: typescript
      file: src/viewers/tui/atoms/theme.ts
    - scanner: typescript
      file: src/viewers/tui/atoms/text.ts
      symbol: text
    - scanner: typescript
      file: src/viewers/tui/atoms/visible.ts
      symbol: visible
    - scanner: typescript
      file: src/viewers/tui/molecules/route.ts
    - scanner: typescript
      file: src/viewers/tui/organisms/world.ts
      symbol: drawWorld
    - scanner: typescript
      file: src/viewers/tui/molecules/building.ts
      symbol: drawBuilding
    - scanner: typescript
      file: src/viewers/tui/molecules/row.ts
      symbol: drawRow
    - scanner: typescript
      file: src/viewers/tui/molecules/surface.ts
    - scanner: typescript
      file: src/viewers/tui/molecules/work-marker.ts
      symbol: drawWorkCorner
    - scanner: typescript
      file: src/viewers/tui/organisms/empty.ts
      symbol: drawEmptyWorld
---

Paints the projected terminal map as islands, container rows, component buildings, source floors, routes and task markers. Explicit flow or task state controls connection emphasis; ordinary map selection does not. It also paints the invitation when the architecture is empty.
