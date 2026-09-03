---
type: C4 Component
title: Checkout cache
status: stable
groma:
  id: checkout-cache
  parent: checkout
  group: Core
  code:
    - scanner: typescript
      file: src/orders/checkout/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/orders/checkout/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/orders/checkout/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/orders/checkout/cache-3.ts
      symbol: cache
---

Checkout cache of Checkout.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [checkout-validator](checkout-validator.md) | Calls validator | HTTP |
| [checkout-mapper](checkout-mapper.md) | Reads mapper | HTTP |
