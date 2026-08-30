---
id: architecture-watch
kind: component
parent: view-host
group: "Live sources"
code:
  - scanner: typescript
    file: src/architecture-watch.ts
    symbol: watchArchitecture
    dependencies: 0
    dependents: 2
---

# Architecture watch

Watches observed, planned, and missing architecture Markdown and settles changes so a live host republishes without scanning.
