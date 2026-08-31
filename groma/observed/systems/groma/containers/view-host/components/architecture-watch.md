---
type: C4 Component
title: Architecture watch
status: stable
groma:
  id: architecture-watch
  parent: view-host
  group: Live sources
  code:
    - scanner: typescript
      file: src/architecture-watch.ts
      symbol: watchArchitecture
      dependencies: 0
      dependents: 3
---

Watches observed, planned, and missing architecture Markdown and settles changes so a live host republishes without scanning.
