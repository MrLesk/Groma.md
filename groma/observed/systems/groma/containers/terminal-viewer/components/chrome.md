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
---

Draws the fixed terminal header, pane boundaries, focus marks, help hints, and footer around the map viewport.
