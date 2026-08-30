---
id: backlog-plugin
kind: component
parent: view-host
group: "Live sources"
code:
  - scanner: typescript
    file: src/work/backlog.ts
    dependencies: 1
    dependents: 2
---

# Backlog plugin

Reads the configured Backlog workflow and tasks and watches task records without blocking architecture rendering.
