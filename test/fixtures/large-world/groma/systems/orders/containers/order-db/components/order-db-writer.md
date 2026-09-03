---
type: C4 Component
title: Order Db writer
status: stable
groma:
  id: order-db-writer
  parent: order-db
  group: Support
  code:
    - scanner: typescript
      file: src/orders/order-db/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/orders/order-db/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/orders/order-db/writer-2.ts
      symbol: writer
---

Order Db writer of Order Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-db-queue](order-db-queue.md) | Calls queue | HTTP |
| [order-db-worker](order-db-worker.md) | Reads worker | HTTP |
