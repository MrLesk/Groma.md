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

Mounts the terminal screen on the renderer: header, hierarchy pane, map pane, details pane and footer in fixed chrome, turns every key into one navigation action, and repaints whenever the terminal host publishes a new world.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Navigation](navigation.md) | Reduces every key over the viewer state | reduceViewer |
| [Projection](projection.md) | Paints the map pane | OpenTUI |
