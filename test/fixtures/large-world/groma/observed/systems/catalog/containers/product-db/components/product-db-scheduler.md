---
type: C4 Component
title: Product Db scheduler
status: stable
groma:
  id: product-db-scheduler
  parent: product-db
  code:
    - scanner: typescript
      file: src/catalog/product-db/scheduler.ts
      symbol: scheduler
---

Product Db scheduler of Product Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [product-db-metrics](product-db-metrics.md) | Calls metrics | HTTP |
| [product-db-config](product-db-config.md) | Reads config | HTTP |
