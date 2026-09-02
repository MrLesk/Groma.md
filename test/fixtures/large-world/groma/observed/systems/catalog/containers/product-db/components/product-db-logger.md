---
type: C4 Component
title: Product Db logger
status: stable
groma:
  id: product-db-logger
  parent: product-db
  code:
    - scanner: typescript
      file: src/catalog/product-db/logger.ts
      symbol: logger
    - scanner: typescript
      file: src/catalog/product-db/logger-1.ts
      symbol: logger
    - scanner: typescript
      file: src/catalog/product-db/logger-2.ts
      symbol: logger
    - scanner: typescript
      file: src/catalog/product-db/logger-3.ts
      symbol: logger
---

Product Db logger of Product Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [product-db-client](product-db-client.md) | Calls client | HTTP |
