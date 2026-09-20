---
type: C4 Component
title: Terminal session
status: stable
groma:
  id: src-view-host
  parent: cli
  code:
    - scanner: typescript
      file: src/view-host.ts
    - scanner: typescript
      file: src/viewers/tui/terminal-viewer.ts
    - scanner: typescript
      file: src/viewers/tui/model.ts
      symbol: TerminalViewModel
  group: Terminal map
description: Runs the terminal viewer and connects it to live architecture updates
---

Starts the terminal renderer and connects it to architecture, scanner, and task updates. Loads source details and selected Git revisions.
