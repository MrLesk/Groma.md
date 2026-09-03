---
type: C4 Component
title: Cart logger
status: stable
groma:
  id: cart-logger
  parent: cart
  code:
    - scanner: typescript
      file: src/orders/cart/logger.ts
      symbol: logger
    - scanner: typescript
      file: src/orders/cart/logger-1.ts
      symbol: logger
    - scanner: typescript
      file: src/orders/cart/logger-2.ts
      symbol: logger
    - scanner: typescript
      file: src/orders/cart/logger-3.ts
      symbol: logger
---

Cart logger of Cart.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cart-client](cart-client.md) | Calls client | HTTP |
