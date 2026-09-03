---
type: C4 Component
title: Catalog Api writer
status: stable
groma:
  id: catalog-api-writer
  parent: catalog-api
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/catalog-api/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/catalog/catalog-api/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/catalog/catalog-api/writer-2.ts
      symbol: writer
---

Catalog Api writer of Catalog Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [catalog-api-queue](catalog-api-queue.md) | Calls queue | HTTP |
| [catalog-api-worker](catalog-api-worker.md) | Reads worker | HTTP |
