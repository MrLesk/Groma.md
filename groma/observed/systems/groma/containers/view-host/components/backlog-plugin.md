---
id: backlog-plugin
kind: component
parent: view-host
code:
  - scanner: typescript
    file: src/backlog-plugin.ts
    symbol: createBacklogPlugin
---

# Backlog plugin

Reads in-progress Backlog tasks and watches the task directory. The view
host owns when that happens; a failed read leaves the map alone.

