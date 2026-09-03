---
type: C4 Component
title: Order Db metrics
status: stable
groma:
  id: order-db-metrics
  parent: order-db
  code:
    - scanner: typescript
      file: src/orders/order-db/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/orders/order-db/metrics-1.ts
      symbol: metrics
---

Order Db metrics of Order Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-db-config](order-db-config.md) | Calls config | HTTP |
| [order-db-logger](order-db-logger.md) | Reads logger | HTTP |
