---
type: C4 Component
title: Terminal drawing
status: stable
groma:
  id: tui-paint
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/tui/paint.ts
      symbol: paintMap
    - scanner: typescript
      file: src/viewers/tui/organisms/world.ts
    - scanner: typescript
      file: src/viewers/tui/organisms/empty.ts
      symbol: drawEmptyWorld
    - scanner: typescript
      file: src/viewers/tui/atoms/border.ts
    - scanner: typescript
      file: src/viewers/tui/atoms/cell.ts
      symbol: cell
    - scanner: typescript
      file: src/viewers/tui/atoms/text.ts
      symbol: text
    - scanner: typescript
      file: src/viewers/tui/atoms/theme.ts
    - scanner: typescript
      file: src/viewers/tui/atoms/visible.ts
      symbol: visible
    - scanner: typescript
      file: src/viewers/tui/molecules/building.ts
      symbol: drawBuilding
    - scanner: typescript
      file: src/viewers/tui/molecules/flow-marker.ts
      symbol: drawFlowMarker
    - scanner: typescript
      file: src/viewers/tui/molecules/route.ts
    - scanner: typescript
      file: src/viewers/tui/molecules/row.ts
      symbol: drawRow
    - scanner: typescript
      file: src/viewers/tui/molecules/surface.ts
    - scanner: typescript
      file: src/viewers/tui/molecules/work-marker.ts
      symbol: drawWorkCorner
  group: Terminal map
---

Draws the map buildings, routes, and markers with terminal characters. Applies the shared terminal styles.
