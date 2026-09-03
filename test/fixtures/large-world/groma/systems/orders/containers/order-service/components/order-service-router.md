---
type: C4 Component
title: Order Service router
status: stable
groma:
  id: order-service-router
  parent: order-service
  group: Core
  code:
    - scanner: typescript
      file: src/orders/order-service/router.ts
      symbol: router
    - scanner: typescript
      file: src/orders/order-service/router-1.ts
      symbol: router
---

Order Service router of Order Service.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-service-session](order-service-session.md) | Calls session | HTTP |
| [order-service-cache](order-service-cache.md) | Reads cache | HTTP |
