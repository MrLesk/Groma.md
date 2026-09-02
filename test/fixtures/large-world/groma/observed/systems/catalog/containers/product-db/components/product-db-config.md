---
type: C4 Component
title: Product Db config
status: stable
groma:
  id: product-db-config
  parent: product-db
  code:
    - scanner: typescript
      file: src/catalog/product-db/config.ts
      symbol: config
    - scanner: typescript
      file: src/catalog/product-db/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/catalog/product-db/config-2.ts
      symbol: config
---

Product Db config of Product Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [product-db-logger](product-db-logger.md) | Calls logger | HTTP |
| [product-db-client](product-db-client.md) | Reads client | HTTP |
