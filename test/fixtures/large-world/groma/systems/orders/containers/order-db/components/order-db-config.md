---
type: C4 Component
title: Order Db config
status: stable
groma:
  id: order-db-config
  parent: order-db
  code:
    - scanner: typescript
      file: src/orders/order-db/config.ts
      symbol: config
    - scanner: typescript
      file: src/orders/order-db/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/orders/order-db/config-2.ts
      symbol: config
---

Order Db config of Order Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-db-logger](order-db-logger.md) | Calls logger | HTTP |
| [order-db-client](order-db-client.md) | Reads client | HTTP |
