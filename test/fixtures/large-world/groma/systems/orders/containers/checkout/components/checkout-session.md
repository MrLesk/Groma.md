---
type: C4 Component
title: Checkout session
status: stable
groma:
  id: checkout-session
  parent: checkout
  group: Core
  code:
    - scanner: typescript
      file: src/orders/checkout/session.ts
      symbol: session
    - scanner: typescript
      file: src/orders/checkout/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/orders/checkout/session-2.ts
      symbol: session
---

Checkout session of Checkout.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [checkout-cache](checkout-cache.md) | Calls cache | HTTP |
| [checkout-validator](checkout-validator.md) | Reads validator | HTTP |
