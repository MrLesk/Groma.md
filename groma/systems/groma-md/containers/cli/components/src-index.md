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
description: Starts the Python analysis runtime and returns its scan results
---

Selects Python source and project declarations. Starts the bundled analysis runtime in a worker thread and returns scan results or source outlines.
