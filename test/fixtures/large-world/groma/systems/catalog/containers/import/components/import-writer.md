---
type: C4 Component
title: Import writer
status: stable
groma:
  id: import-writer
  parent: import
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/import/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/catalog/import/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/catalog/import/writer-2.ts
      symbol: writer
---

Import writer of Import.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [import-queue](import-queue.md) | Calls queue | HTTP |
| [import-worker](import-worker.md) | Reads worker | HTTP |
