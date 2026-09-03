---
type: C4 Component
title: Checkout mapper
status: stable
groma:
  id: checkout-mapper
  parent: checkout
  group: Support
  code:
    - scanner: typescript
      file: src/orders/checkout/mapper.ts
      symbol: mapper
---

Checkout mapper of Checkout.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [checkout-reader](checkout-reader.md) | Calls reader | HTTP |
| [checkout-writer](checkout-writer.md) | Reads writer | HTTP |
