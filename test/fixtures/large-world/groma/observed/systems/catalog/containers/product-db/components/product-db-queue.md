---
type: C4 Component
title: Product Db queue
status: stable
groma:
  id: product-db-queue
  parent: product-db
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/product-db/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/catalog/product-db/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/catalog/product-db/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/catalog/product-db/queue-3.ts
      symbol: queue
---

Product Db queue of Product Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [product-db-worker](product-db-worker.md) | Calls worker | HTTP |
| [product-db-scheduler](product-db-scheduler.md) | Reads scheduler | HTTP |
