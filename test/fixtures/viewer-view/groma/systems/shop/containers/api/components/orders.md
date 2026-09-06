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
