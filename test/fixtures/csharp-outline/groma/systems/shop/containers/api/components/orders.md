---
type: C4 Component
title: Orders
status: stable
groma:
  id: orders
  parent: api
  code:
    - scanner: csharp
      file: Orders/OrderService.cs
      symbol: OrderService
    - scanner: typescript
      file: web/orders.ts
    - scanner: csharp
      file: Orders/OrderService.Audit.cs
---

Records orders.
