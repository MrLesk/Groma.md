---
type: C4 Component
title: Cart cache
status: stable
groma:
  id: cart-cache
  parent: cart
  group: Core
  code:
    - scanner: typescript
      file: src/orders/cart/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/orders/cart/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/orders/cart/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/orders/cart/cache-3.ts
      symbol: cache
---

Cart cache of Cart.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cart-validator](cart-validator.md) | Calls validator | HTTP |
| [cart-mapper](cart-mapper.md) | Reads mapper | HTTP |
