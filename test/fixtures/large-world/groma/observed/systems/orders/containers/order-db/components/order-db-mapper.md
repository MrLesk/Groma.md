---
type: C4 Component
title: Order Db mapper
status: stable
groma:
  id: order-db-mapper
  parent: order-db
  group: Support
  code:
    - scanner: typescript
      file: src/orders/order-db/mapper.ts
      symbol: mapper
---

Order Db mapper of Order Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-db-reader](order-db-reader.md) | Calls reader | HTTP |
| [order-db-writer](order-db-writer.md) | Reads writer | HTTP |
