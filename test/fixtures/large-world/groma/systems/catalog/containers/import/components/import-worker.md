---
type: C4 Component
title: Import worker
status: stable
groma:
  id: import-worker
  parent: import
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/import/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/import/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/import/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/import/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/import/worker-4.ts
      symbol: worker
---

Import worker of Import.
