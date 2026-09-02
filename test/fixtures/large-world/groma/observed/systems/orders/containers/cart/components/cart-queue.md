---
type: C4 Component
title: Cart queue
status: stable
groma:
  id: cart-queue
  parent: cart
  group: Support
  code:
    - scanner: typescript
      file: src/orders/cart/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/orders/cart/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/orders/cart/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/orders/cart/queue-3.ts
      symbol: queue
---

Cart queue of Cart.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cart-worker](cart-worker.md) | Calls worker | HTTP |
| [cart-scheduler](cart-scheduler.md) | Reads scheduler | HTTP |
