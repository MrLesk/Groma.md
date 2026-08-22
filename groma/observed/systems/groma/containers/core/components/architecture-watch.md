---
id: architecture-watch
kind: component
parent: core
code:
  - scanner: typescript
    file: src/architecture-watch.ts
    symbol: watchArchitecture
---

# Architecture watch

Watches `groma/observed` and `groma/plans` for Markdown changes and settles them, so a live viewer reloads the world without scanning.
