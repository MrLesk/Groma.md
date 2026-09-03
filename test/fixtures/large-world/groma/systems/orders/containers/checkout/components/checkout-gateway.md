---
type: C4 Component
title: Checkout gateway
status: stable
groma:
  id: checkout-gateway
  parent: checkout
  group: Core
  code:
    - scanner: typescript
      file: src/orders/checkout/gateway.ts
      symbol: gateway
---

Checkout gateway of Checkout.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [checkout-router](checkout-router.md) | Calls router | HTTP |
| [checkout-session](checkout-session.md) | Reads session | HTTP |
| [cart-gateway](../../../../orders/containers/cart/components/cart-gateway.md) | Forwards requests | HTTP |
