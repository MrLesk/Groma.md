---
type: C4 Component
title: Terminal panels
status: stable
groma:
  id: screen
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/tui/panes/screen.ts
    - scanner: typescript
      file: src/viewers/tui/panes/view.ts
      symbol: screenView
    - scanner: typescript
      file: src/viewers/tui/panes/chrome.ts
    - scanner: typescript
      file: src/viewers/tui/panes/code.ts
    - scanner: typescript
      file: src/viewers/tui/panes/details.ts
    - scanner: typescript
      file: src/viewers/tui/panes/hierarchy.ts
    - scanner: typescript
      file: src/viewers/tui/panes/text.ts
  group: Terminal map
---

Shows the architecture tree, component details, and source text beside the map. Fits the panels to the terminal size.
