---
type: C4 Component
title: Orders
status: stable
groma:
  id: orders
  parent: api
  technology: Typescript, Postgres
  code:
    - scanner: typescript
      file: src/orders.ts
      symbol: placeOrder
---

Records an order and its lines.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Order page](../../order-viewer/components/order-page.md) | Supplies placed orders | In-process data |
