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
    - scanner: typescript
      file: src/viewers/tui/layout.ts
    - scanner: typescript
      file: src/viewers/tui/model.ts
      symbol: TerminalViewModel
    - scanner: typescript
      file: src/viewers/tui/panes/view.ts
      symbol: screenView
---

Mounts the terminal viewer and reserves one fixed layout for header, hierarchy, map, details, footer, and Backlog recap.
