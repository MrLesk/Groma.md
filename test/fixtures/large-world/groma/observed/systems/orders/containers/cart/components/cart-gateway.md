---
type: C4 Component
title: Cart gateway
status: stable
groma:
  id: cart-gateway
  parent: cart
  group: Core
  code:
    - scanner: typescript
      file: src/orders/cart/gateway.ts
      symbol: gateway
---

Cart gateway of Cart.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cart-router](cart-router.md) | Calls router | HTTP |
| [cart-session](cart-session.md) | Reads session | HTTP |
| [order-service-gateway](../../../../orders/containers/order-service/components/order-service-gateway.md) | Forwards requests | HTTP |
