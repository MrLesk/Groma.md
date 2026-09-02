---
type: C4 Component
title: Chrome
status: stable
groma:
  id: chrome
  parent: terminal-viewer
  group: Terminal presentation
  code:
    - scanner: typescript
      file: src/viewers/tui/organisms/chrome.ts
      symbol: drawChrome
      dependencies: 7
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/panes/chrome.ts
      dependencies: 3
      dependents: 2
    - scanner: typescript
      file: src/viewers/tui/panes/screen.ts
      dependencies: 8
      dependents: 2
    - scanner: typescript
      file: src/viewers/tui/panes/text.ts
      dependencies: 1
      dependents: 5
---

Draws the fixed terminal header, pane boundaries, focus marks, help hints, and footer around the map viewport.
