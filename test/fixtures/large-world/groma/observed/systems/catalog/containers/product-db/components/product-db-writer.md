---
type: C4 Component
title: Product Db writer
status: stable
groma:
  id: product-db-writer
  parent: product-db
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/product-db/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/catalog/product-db/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/catalog/product-db/writer-2.ts
      symbol: writer
---

Product Db writer of Product Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [product-db-queue](product-db-queue.md) | Calls queue | HTTP |
| [product-db-worker](product-db-worker.md) | Reads worker | HTTP |
