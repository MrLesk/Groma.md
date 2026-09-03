---
type: C4 Component
title: Cart writer
status: stable
groma:
  id: cart-writer
  parent: cart
  group: Support
  code:
    - scanner: typescript
      file: src/orders/cart/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/orders/cart/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/orders/cart/writer-2.ts
      symbol: writer
---

Cart writer of Cart.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cart-queue](cart-queue.md) | Calls queue | HTTP |
| [cart-worker](cart-worker.md) | Reads worker | HTTP |
