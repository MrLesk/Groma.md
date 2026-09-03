---
type: C4 Component
title: Order Db scheduler
status: stable
groma:
  id: order-db-scheduler
  parent: order-db
  code:
    - scanner: typescript
      file: src/orders/order-db/scheduler.ts
      symbol: scheduler
---

Order Db scheduler of Order Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-db-metrics](order-db-metrics.md) | Calls metrics | HTTP |
| [order-db-config](order-db-config.md) | Reads config | HTTP |
