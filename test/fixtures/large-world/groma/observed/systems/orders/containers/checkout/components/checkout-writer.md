---
type: C4 Component
title: Checkout writer
status: stable
groma:
  id: checkout-writer
  parent: checkout
  group: Support
  code:
    - scanner: typescript
      file: src/orders/checkout/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/orders/checkout/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/orders/checkout/writer-2.ts
      symbol: writer
---

Checkout writer of Checkout.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [checkout-queue](checkout-queue.md) | Calls queue | HTTP |
| [checkout-worker](checkout-worker.md) | Reads worker | HTTP |
