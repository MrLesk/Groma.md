---
id: terminal-painting
kind: component
parent: terminal-viewer
group: "Terminal presentation"
code:
  - scanner: typescript
    file: src/viewers/tui/paint.ts
    symbol: paintWorld
    dependencies: 14
    dependents: 1
  - scanner: typescript
    file: src/viewers/tui/atoms/border.ts
    dependencies: 2
    dependents: 5
  - scanner: typescript
    file: src/viewers/tui/molecules/boundary.ts
    dependencies: 6
    dependents: 1
  - scanner: typescript
    file: src/viewers/tui/molecules/card.ts
    symbol: drawCard
    dependencies: 7
    dependents: 1
  - scanner: typescript
    file: src/viewers/tui/atoms/cell.ts
    symbol: cell
    dependencies: 0
    dependents: 8
  - scanner: typescript
    file: src/viewers/tui/molecules/flow-marker.ts
    symbol: drawFlowMarker
    dependencies: 3
    dependents: 1
  - scanner: typescript
    file: src/viewers/tui/molecules/hatch.ts
    dependencies: 2
    dependents: 1
  - scanner: typescript
    file: src/viewers/tui/molecules/spine.ts
    symbol: drawSpine
    dependencies: 2
    dependents: 1
  - scanner: typescript
    file: src/viewers/tui/atoms/theme.ts
    dependencies: 1
    dependents: 10
  - scanner: typescript
    file: src/viewers/tui/atoms/text.ts
    symbol: text
    dependencies: 0
    dependents: 9
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
    dependencies: 10
    dependents: 1
---

# Terminal painting

Turns projected architecture into terminal cells through the shared surface, card, route, label, pattern, and work-marker primitives.
