---
type: C4 Component
title: Checkout orders
status: draft
groma:
  id: orders
  parent: api
  code:
    - scanner: typescript
      file: src/checkout-orders.ts
      symbol: checkout
---

Places an order through a guided checkout.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Payments](../../../../payments/system.md) | Authorizes checkout payment | HTTPS |
