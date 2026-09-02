---
type: C4 Component
title: Product Db worker
status: stable
groma:
  id: product-db-worker
  parent: product-db
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/product-db/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/product-db/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/product-db/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/product-db/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/product-db/worker-4.ts
      symbol: worker
---

Product Db worker of Product Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [product-db-scheduler](product-db-scheduler.md) | Calls scheduler | HTTP |
| [product-db-metrics](product-db-metrics.md) | Reads metrics | HTTP |
