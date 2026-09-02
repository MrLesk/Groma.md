---
type: C4 Component
title: Cart router
status: stable
groma:
  id: cart-router
  parent: cart
  group: Core
  code:
    - scanner: typescript
      file: src/orders/cart/router.ts
      symbol: router
    - scanner: typescript
      file: src/orders/cart/router-1.ts
      symbol: router
---

Cart router of Cart.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cart-session](cart-session.md) | Calls session | HTTP |
| [cart-cache](cart-cache.md) | Reads cache | HTTP |
