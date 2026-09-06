---
type: C4 Component
title: Search
status: stable
groma:
  id: search
  parent: core
  group: Architecture world
  code:
    - scanner: typescript
      file: src/search.ts
---

Builds one ranked semantic index over the current architecture revision so every viewer finds the same elements with ancestor context.
