---
type: C4 Component
title: Order Service worker
status: stable
groma:
  id: order-service-worker
  parent: order-service
  group: Support
  code:
    - scanner: typescript
      file: src/orders/order-service/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/orders/order-service/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/orders/order-service/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/orders/order-service/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/orders/order-service/worker-4.ts
      symbol: worker
---

Order Service worker of Order Service.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-service-scheduler](order-service-scheduler.md) | Calls scheduler | HTTP |
| [order-service-metrics](order-service-metrics.md) | Reads metrics | HTTP |
