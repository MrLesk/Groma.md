---
id: terminal-viewer
kind: container
parent: groma
technology: OpenTUI
code:
  - scanner: typescript
    file: src/viewers/tui/terminal-viewer.ts
    symbol: mountTerminalViewer
---

# Terminal viewer

Shows the architecture in a terminal as a map between a hierarchy tree and a details pane: one campus over three C4 levels, a selection-first navigation where arrows move between siblings and Enter descends, and a camera that only ever follows the selection. The view host starts it.
