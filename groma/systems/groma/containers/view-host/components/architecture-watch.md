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
---

Watches the Groma directory for architecture Markdown changes and settles them so a live host republishes without scanning.
