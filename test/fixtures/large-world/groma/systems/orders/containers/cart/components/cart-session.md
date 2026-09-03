---
type: C4 Component
title: Cart session
status: stable
groma:
  id: cart-session
  parent: cart
  group: Core
  code:
    - scanner: typescript
      file: src/orders/cart/session.ts
      symbol: session
    - scanner: typescript
      file: src/orders/cart/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/orders/cart/session-2.ts
      symbol: session
---

Cart session of Cart.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cart-cache](cart-cache.md) | Calls cache | HTTP |
| [cart-validator](cart-validator.md) | Reads validator | HTTP |
