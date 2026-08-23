---
id: backlog-plugin
kind: component
parent: view-host
code:
  - scanner: typescript
    file: src/work/backlog.ts
    symbol: createBacklogPlugin
---

# Backlog plugin

Reads the configured Backlog workflow and available tasks through the `backlog` CLI, and watches the task directory for changes. The view host owns when that happens; a failed read leaves the map alone.
