---
type: C4 Component
title: Order Service metrics
status: stable
groma:
  id: order-service-metrics
  parent: order-service
  code:
    - scanner: typescript
      file: src/orders/order-service/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/orders/order-service/metrics-1.ts
      symbol: metrics
---

Order Service metrics of Order Service.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-service-config](order-service-config.md) | Calls config | HTTP |
| [order-service-logger](order-service-logger.md) | Reads logger | HTTP |
