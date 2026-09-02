---
type: C4 Component
title: Order Db session
status: stable
groma:
  id: order-db-session
  parent: order-db
  group: Core
  code:
    - scanner: typescript
      file: src/orders/order-db/session.ts
      symbol: session
    - scanner: typescript
      file: src/orders/order-db/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/orders/order-db/session-2.ts
      symbol: session
---

Order Db session of Order Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-db-cache](order-db-cache.md) | Calls cache | HTTP |
| [order-db-validator](order-db-validator.md) | Reads validator | HTTP |
