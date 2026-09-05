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
      dependencies: 0
      dependents: 0
---

Embeds the official Backlog work source, reports whether the global Backlog.md
CLI is available, and reads and watches task records when it is. A missing CLI
supplies empty work without blocking architecture rendering.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Work source contract](work-source-contract.md) | Implements work reads, detail reads, readiness and watch lifecycle | `@groma/work-source` |
| [Backlog.md](../../../../../externals/backlog-md.md) | Reads task summaries, selected task details, and workflow settings without writing tasks | Backlog CLI: task list --json, task view <id> --json, config get |
