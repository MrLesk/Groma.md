---
type: C4 Component
title: Order Service writer
status: stable
groma:
  id: order-service-writer
  parent: order-service
  group: Support
  code:
    - scanner: typescript
      file: src/orders/order-service/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/orders/order-service/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/orders/order-service/writer-2.ts
      symbol: writer
---

Order Service writer of Order Service.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-service-queue](order-service-queue.md) | Calls queue | HTTP |
| [order-service-worker](order-service-worker.md) | Reads worker | HTTP |
