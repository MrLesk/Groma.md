---
type: C4 Component
title: Python scanner adapter
status: stable
groma:
  id: src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/python/src/index.ts
  group: Language analysis
---

Selects Python source files and checks the Python interpreter. Starts the Python worker and reads its scan result.
