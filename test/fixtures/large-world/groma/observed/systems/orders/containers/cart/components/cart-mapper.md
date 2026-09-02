---
type: C4 Component
title: Cart mapper
status: stable
groma:
  id: cart-mapper
  parent: cart
  group: Support
  code:
    - scanner: typescript
      file: src/orders/cart/mapper.ts
      symbol: mapper
---

Cart mapper of Cart.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cart-reader](cart-reader.md) | Calls reader | HTTP |
| [cart-writer](cart-writer.md) | Reads writer | HTTP |
