---
id: screen
kind: component
parent: terminal-viewer
code:
  - scanner: typescript
    file: src/viewers/tui/terminal-viewer.ts
    symbol: mountTerminalViewer
---

# Screen

Mounts the terminal screen with fixed chrome: header, persistent hierarchy, map, reserved details pane, and footer. It opens selected containers, returns to the root, reduces navigation keys, animates active flows on a presentation-only clock, and repaints new worlds without resetting valid viewer state.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Navigation](navigation.md) | Reduces every key over the viewer state | reduceViewer |
| [Projection](projection.md) | Paints the map pane | OpenTUI |
