---
type: C4 Component
title: World loader
status: stable
groma:
  id: world-loader
  parent: core
  group: Architecture world
  code:
    - scanner: typescript
      file: src/core.ts
---

Loads every revision into one annotated architecture graph, resolves winning representations, stable relationships, direct children, and source-file measurements for all viewers.
