---
type: C4 Component
title: Order Service cache
status: stable
groma:
  id: order-service-cache
  parent: order-service
  group: Core
  code:
    - scanner: typescript
      file: src/orders/order-service/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/orders/order-service/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/orders/order-service/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/orders/order-service/cache-3.ts
      symbol: cache
---

Order Service cache of Order Service.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-service-validator](order-service-validator.md) | Calls validator | HTTP |
| [order-service-mapper](order-service-mapper.md) | Reads mapper | HTTP |
