---
type: C4 Component
title: Checkout reader
status: stable
groma:
  id: checkout-reader
  parent: checkout
  group: Support
  code:
    - scanner: typescript
      file: src/orders/checkout/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/orders/checkout/reader-1.ts
      symbol: reader
---

Checkout reader of Checkout.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [checkout-writer](checkout-writer.md) | Calls writer | HTTP |
| [checkout-queue](checkout-queue.md) | Reads queue | HTTP |
