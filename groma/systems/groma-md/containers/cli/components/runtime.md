---
type: C4 Component
title: Python analysis runtime
status: stable
groma:
  id: runtime
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/python/worker/runtime.ts
    - scanner: typescript
      file: plugins/scanners/python/worker/modules.ts
      symbol: workerModules
  group: Language analysis
---

Runs Python analysis in a worker thread using the bundled Pyodide interpreter. Loads the selected source files and analysis modules, then returns a scan result or source outline.
