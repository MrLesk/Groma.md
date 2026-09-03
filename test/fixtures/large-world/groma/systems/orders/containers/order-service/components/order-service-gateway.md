---
type: C4 Component
title: Order Service gateway
status: stable
groma:
  id: order-service-gateway
  parent: order-service
  group: Core
  code:
    - scanner: typescript
      file: src/orders/order-service/gateway.ts
      symbol: gateway
---

Order Service gateway of Order Service.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-service-router](order-service-router.md) | Calls router | HTTP |
| [order-service-session](order-service-session.md) | Reads session | HTTP |
| [order-db-gateway](../../../../orders/containers/order-db/components/order-db-gateway.md) | Forwards requests | HTTP |
