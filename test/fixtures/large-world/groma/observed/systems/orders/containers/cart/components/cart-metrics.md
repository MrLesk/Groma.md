---
type: C4 Component
title: Cart metrics
status: stable
groma:
  id: cart-metrics
  parent: cart
  code:
    - scanner: typescript
      file: src/orders/cart/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/orders/cart/metrics-1.ts
      symbol: metrics
---

Cart metrics of Cart.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cart-config](cart-config.md) | Calls config | HTTP |
| [cart-logger](cart-logger.md) | Reads logger | HTTP |
