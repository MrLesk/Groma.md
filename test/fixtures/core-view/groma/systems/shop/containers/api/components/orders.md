---
type: C4 Component
title: Orders
status: stable
groma:
  id: orders
  parent: api
  code:
    - scanner: typescript
      file: src/orders.ts
      symbol: placeOrder
    - scanner: routes
      file: src/routes/orders.ts
  draft: inventory
---

Places and tracks customer orders.
