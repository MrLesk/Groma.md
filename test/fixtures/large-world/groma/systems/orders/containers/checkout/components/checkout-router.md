---
type: C4 Component
title: Checkout router
status: stable
groma:
  id: checkout-router
  parent: checkout
  group: Core
  code:
    - scanner: typescript
      file: src/orders/checkout/router.ts
      symbol: router
    - scanner: typescript
      file: src/orders/checkout/router-1.ts
      symbol: router
---

Checkout router of Checkout.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [checkout-session](checkout-session.md) | Calls session | HTTP |
| [checkout-cache](checkout-cache.md) | Reads cache | HTTP |
