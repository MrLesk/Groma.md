---
type: C4 Component
title: Product Db gateway
status: stable
groma:
  id: product-db-gateway
  parent: product-db
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/product-db/gateway.ts
      symbol: gateway
---

Product Db gateway of Product Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [product-db-router](product-db-router.md) | Calls router | HTTP |
| [product-db-session](product-db-session.md) | Reads session | HTTP |
| [import-gateway](../../../../catalog/containers/import/components/import-gateway.md) | Forwards requests | HTTP |
