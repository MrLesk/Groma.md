---
id: architecture-watch
kind: component
parent: core
code:
  - scanner: typescript
    file: src/architecture-watch.ts
    symbol: watchArchitecture
    dependencies: 0
    dependents: 2
---

# Architecture watch

Watches the observed, planned, and missing architecture Markdown, then settles changes so a live viewer republishes without scanning.
