---
type: C4 Component
title: Orders
status: stable
groma:
  id: orders
  parent: api
  code:
    - scanner: typescript
      file: web/orders.ts
    - scanner: python
      file: app/orders.py
      symbol: place_order
    - scanner: python
      file: app/orders.py
      symbol: OrderService.fetch
---

Records orders.
