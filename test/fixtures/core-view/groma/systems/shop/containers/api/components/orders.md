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
      dependencies: 3
      dependents: 5
    - scanner: routes
      file: src/routes/orders.ts
  draft: inventory
---

Places and tracks customer orders.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Payments](../../../../../externals/payments.md) | Requests payment authorization | HTTPS |
