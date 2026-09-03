---
type: C4 Component
title: Checkout metrics
status: stable
groma:
  id: checkout-metrics
  parent: checkout
  code:
    - scanner: typescript
      file: src/orders/checkout/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/orders/checkout/metrics-1.ts
      symbol: metrics
---

Checkout metrics of Checkout.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [checkout-config](checkout-config.md) | Calls config | HTTP |
| [checkout-logger](checkout-logger.md) | Reads logger | HTTP |
