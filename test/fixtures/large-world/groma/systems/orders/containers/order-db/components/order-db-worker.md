---
type: C4 Component
title: Order Db worker
status: stable
groma:
  id: order-db-worker
  parent: order-db
  group: Support
  code:
    - scanner: typescript
      file: src/orders/order-db/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/orders/order-db/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/orders/order-db/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/orders/order-db/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/orders/order-db/worker-4.ts
      symbol: worker
---

Order Db worker of Order Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-db-scheduler](order-db-scheduler.md) | Calls scheduler | HTTP |
| [order-db-metrics](order-db-metrics.md) | Reads metrics | HTTP |
