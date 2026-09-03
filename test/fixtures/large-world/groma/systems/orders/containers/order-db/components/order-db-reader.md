---
type: C4 Component
title: Order Db reader
status: stable
groma:
  id: order-db-reader
  parent: order-db
  group: Support
  code:
    - scanner: typescript
      file: src/orders/order-db/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/orders/order-db/reader-1.ts
      symbol: reader
---

Order Db reader of Order Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-db-writer](order-db-writer.md) | Calls writer | HTTP |
| [order-db-queue](order-db-queue.md) | Reads queue | HTTP |
