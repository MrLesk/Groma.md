---
type: C4 Component
title: Product Db session
status: stable
groma:
  id: product-db-session
  parent: product-db
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/product-db/session.ts
      symbol: session
    - scanner: typescript
      file: src/catalog/product-db/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/catalog/product-db/session-2.ts
      symbol: session
---

Product Db session of Product Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [product-db-cache](product-db-cache.md) | Calls cache | HTTP |
| [product-db-validator](product-db-validator.md) | Reads validator | HTTP |
