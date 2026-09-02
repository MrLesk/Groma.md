---
type: C4 Component
title: Screen
status: stable
groma:
  id: screen
  parent: terminal-viewer
  group: Terminal presentation
  code:
    - scanner: typescript
      file: src/viewers/tui/terminal-viewer.ts
      dependencies: 12
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/layout.ts
      dependencies: 1
      dependents: 3
    - scanner: typescript
      file: src/viewers/tui/model.ts
      symbol: TerminalViewModel
      dependencies: 2
      dependents: 10
    - scanner: typescript
      file: src/viewers/tui/panes/view.ts
      symbol: screenView
      dependencies: 14
      dependents: 1
---

Mounts the terminal viewer and reserves one fixed layout for header, hierarchy, map, details, footer, and Backlog recap.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Navigation](navigation.md) | Reduces terminal input over viewer state | In-process data |
| [Projection](projection.md) | Projects the map pane | OpenTUI |
| [Work focus](work-focus.md) | Shows tasks and their architecture touch points | WorkSnapshot |
