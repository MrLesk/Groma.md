---
type: C4 Component
title: Orders
status: stable
groma:
  id: orders
  parent: api
  code:
    - scanner: javascript
      file: app/checkout.mjs
      symbol: placeOrder
    - scanner: javascript
      file: app/checkout.mjs
      symbol: OrderService
    - scanner: javascript
      file: app/totals.cjs
      symbol: subtotal
    - scanner: javascript
      file: app/legacy.js
    - scanner: javascript
      file: app/report.js
---

Records orders.
