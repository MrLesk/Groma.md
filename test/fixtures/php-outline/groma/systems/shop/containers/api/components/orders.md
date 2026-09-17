---
type: C4 Component
title: Orders
status: stable
groma:
  id: orders
  parent: api
  code:
    - scanner: php
      file: app/helpers.php
      symbol: Shop\Support\place_order
    - scanner: typescript
      file: web/orders.ts
    - scanner: php
      file: app/Orders.php
      symbol: Shop\OrderService
    - scanner: php
      file: app/Orders.php
      symbol: Shop\OrderService::store
---

Records orders.
