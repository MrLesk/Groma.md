---
type: C4 Component
title: Order Db router
status: stable
groma:
  id: order-db-router
  parent: order-db
  group: Core
  code:
    - scanner: typescript
      file: src/orders/order-db/router.ts
      symbol: router
    - scanner: typescript
      file: src/orders/order-db/router-1.ts
      symbol: router
---

Order Db router of Order Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-db-session](order-db-session.md) | Calls session | HTTP |
| [order-db-cache](order-db-cache.md) | Reads cache | HTTP |
