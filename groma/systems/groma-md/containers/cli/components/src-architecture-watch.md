---
type: C4 Component
title: Architecture watch
status: stable
groma:
  id: src-architecture-watch
  parent: cli
  code:
    - scanner: typescript
      file: src/architecture-watch.ts
      symbol: watchArchitecture
  group: Architecture records
description: Notifies open viewers when architecture files change
---

Watches the architecture records. Tells open viewers when these records change.
