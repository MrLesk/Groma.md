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

Embeds the official Backlog work source for Web, terminal, and static export. Reads task lists, workflow configuration, and selected task details through the Backlog CLI. Each watch subscription consumes complete task list --json --watch snapshots, replaces the current list, and notifies its host. Closing the subscription stops and awaits the CLI process. It never inspects Backlog storage. A missing CLI supplies empty work without blocking architecture rendering.
