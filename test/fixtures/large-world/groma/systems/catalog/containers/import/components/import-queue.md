---
type: C4 Component
title: Import queue
status: stable
groma:
  id: import-queue
  parent: import
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/import/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/catalog/import/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/catalog/import/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/catalog/import/queue-3.ts
      symbol: queue
---

Import queue of Import.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [import-worker](import-worker.md) | Calls worker | HTTP |
| [import-scheduler](import-scheduler.md) | Reads scheduler | HTTP |
