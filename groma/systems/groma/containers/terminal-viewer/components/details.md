---
type: C4 Component
title: Details
status: stable
groma:
  id: details
  parent: terminal-viewer
  group: Terminal presentation
  code:
    - scanner: typescript
      file: src/viewers/tui/organisms/details.ts
      dependencies: 9
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/panes/details.ts
      dependencies: 8
      dependents: 2
---

Draws the selected architecture element, relationship, command flow, or task in the terminal details pane.
