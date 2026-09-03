---
type: C4 Component
title: Cart scheduler
status: stable
groma:
  id: cart-scheduler
  parent: cart
  code:
    - scanner: typescript
      file: src/orders/cart/scheduler.ts
      symbol: scheduler
---

Cart scheduler of Cart.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cart-metrics](cart-metrics.md) | Calls metrics | HTTP |
| [cart-config](cart-config.md) | Reads config | HTTP |
