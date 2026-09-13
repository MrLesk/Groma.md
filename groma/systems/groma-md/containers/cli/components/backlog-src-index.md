---
type: C4 Component
title: Backlog adapter
status: stable
groma:
  id: backlog-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/work-sources/backlog/src/index.ts
  group: Project work
---

Reads tasks through the Backlog CLI. Watches the CLI output and reports task changes without reading Backlog storage files.
