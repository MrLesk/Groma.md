---
type: C4 Component
title: Order Service session
status: stable
groma:
  id: order-service-session
  parent: order-service
  group: Core
  code:
    - scanner: typescript
      file: src/orders/order-service/session.ts
      symbol: session
    - scanner: typescript
      file: src/orders/order-service/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/orders/order-service/session-2.ts
      symbol: session
---

Order Service session of Order Service.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-service-cache](order-service-cache.md) | Calls cache | HTTP |
| [order-service-validator](order-service-validator.md) | Reads validator | HTTP |
