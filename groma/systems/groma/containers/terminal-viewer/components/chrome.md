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
      file: src/viewers/tui/panes/chrome.ts
    - scanner: typescript
      file: src/viewers/tui/panes/screen.ts
    - scanner: typescript
      file: src/viewers/tui/panes/text.ts
---

Draws the fixed terminal header, pane boundaries, focus marks, help hints, and footer around the map viewport.
