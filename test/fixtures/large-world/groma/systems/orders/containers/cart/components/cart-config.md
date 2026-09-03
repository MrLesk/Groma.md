---
type: C4 Component
title: Cart config
status: stable
groma:
  id: cart-config
  parent: cart
  code:
    - scanner: typescript
      file: src/orders/cart/config.ts
      symbol: config
    - scanner: typescript
      file: src/orders/cart/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/orders/cart/config-2.ts
      symbol: config
---

Cart config of Cart.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cart-logger](cart-logger.md) | Calls logger | HTTP |
| [cart-client](cart-client.md) | Reads client | HTTP |
