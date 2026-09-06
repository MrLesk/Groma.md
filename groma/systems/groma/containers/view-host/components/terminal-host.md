---
type: C4 Component
title: Terminal host
status: stable
groma:
  id: terminal-host
  parent: view-host
  code:
    - scanner: typescript
      file: src/view-host.ts
      symbol: startTerminalViewer
---

Starts the terminal map, publishes live architecture and work snapshots, and loads selected read-only revisions until Current resumes.
