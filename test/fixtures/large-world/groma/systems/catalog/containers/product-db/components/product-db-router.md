---
type: C4 Component
title: Product Db router
status: stable
groma:
  id: product-db-router
  parent: product-db
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/product-db/router.ts
      symbol: router
    - scanner: typescript
      file: src/catalog/product-db/router-1.ts
      symbol: router
---

Product Db router of Product Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [product-db-session](product-db-session.md) | Calls session | HTTP |
| [product-db-cache](product-db-cache.md) | Reads cache | HTTP |
