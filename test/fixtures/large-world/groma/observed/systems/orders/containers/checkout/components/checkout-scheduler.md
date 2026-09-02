---
type: C4 Component
title: Checkout scheduler
status: stable
groma:
  id: checkout-scheduler
  parent: checkout
  code:
    - scanner: typescript
      file: src/orders/checkout/scheduler.ts
      symbol: scheduler
---

Checkout scheduler of Checkout.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [checkout-metrics](checkout-metrics.md) | Calls metrics | HTTP |
| [checkout-config](checkout-config.md) | Reads config | HTTP |
