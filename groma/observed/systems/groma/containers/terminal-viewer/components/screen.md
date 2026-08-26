---
id: screen
kind: component
parent: terminal-viewer
code:
  - scanner: typescript
    file: src/viewers/tui/terminal-viewer.ts
    symbol: mountTerminalViewer
    dependencies: 9
    dependents: 1
  - scanner: typescript
    file: src/viewers/tui/model.ts
    symbol: TerminalViewModel
    dependencies: 2
    dependents: 10
  - scanner: typescript
    file: test-bun/helpers.ts
    dependencies: 5
    dependents: 0
---

# Screen

Mounts the terminal screen with fixed chrome: header, persistent hierarchy, map with a reserved task recap, details pane, and footer. It opens selected containers, gives Work focus a temporary task scope and camera, restores the prior architecture and flow view when Work closes, animates active flows on a presentation-only clock, and reconciles refreshed architecture and tasks without resetting valid viewer state.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Navigation](navigation.md) | Reduces every key over the viewer state | reduceViewer |
| [Projection](projection.md) | Paints the map pane | OpenTUI |
| [Work focus](work-focus.md) | Shows tasks and their architecture touch points | WorkSnapshot |
