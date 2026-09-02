---
type: C4 Component
title: Order Service scheduler
status: stable
groma:
  id: order-service-scheduler
  parent: order-service
  code:
    - scanner: typescript
      file: src/orders/order-service/scheduler.ts
      symbol: scheduler
---

Order Service scheduler of Order Service.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-service-metrics](order-service-metrics.md) | Calls metrics | HTTP |
| [order-service-config](order-service-config.md) | Reads config | HTTP |
