---
type: C4 Component
title: Product Db cache
status: stable
groma:
  id: product-db-cache
  parent: product-db
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/product-db/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/catalog/product-db/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/catalog/product-db/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/catalog/product-db/cache-3.ts
      symbol: cache
---

Product Db cache of Product Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [product-db-validator](product-db-validator.md) | Calls validator | HTTP |
| [product-db-mapper](product-db-mapper.md) | Reads mapper | HTTP |
