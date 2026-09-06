---
type: C4 Component
title: Backlog plugin
status: stable
groma:
  id: backlog-plugin
  parent: view-host
  group: Live sources
  code:
    - scanner: typescript
      file: plugins/work-sources/backlog/src/index.ts
---

Embeds the official Backlog work source, reports whether the global Backlog.md
CLI is available, and reads and watches task records when it is. A missing CLI
supplies empty work without blocking architecture rendering.
