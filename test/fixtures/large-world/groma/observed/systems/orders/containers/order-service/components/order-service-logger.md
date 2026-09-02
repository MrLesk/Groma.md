---
type: C4 Component
title: Order Service logger
status: stable
groma:
  id: order-service-logger
  parent: order-service
  code:
    - scanner: typescript
      file: src/orders/order-service/logger.ts
      symbol: logger
    - scanner: typescript
      file: src/orders/order-service/logger-1.ts
      symbol: logger
    - scanner: typescript
      file: src/orders/order-service/logger-2.ts
      symbol: logger
    - scanner: typescript
      file: src/orders/order-service/logger-3.ts
      symbol: logger
---

Order Service logger of Order Service.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-service-client](order-service-client.md) | Calls client | HTTP |
