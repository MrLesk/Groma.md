---
type: C4 Component
title: Order Db gateway
status: stable
groma:
  id: order-db-gateway
  parent: order-db
  group: Core
  code:
    - scanner: typescript
      file: src/orders/order-db/gateway.ts
      symbol: gateway
---

Order Db gateway of Order Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-db-router](order-db-router.md) | Calls router | HTTP |
| [order-db-session](order-db-session.md) | Reads session | HTTP |
| [events-gateway](../../../../orders/containers/events/components/events-gateway.md) | Forwards requests | HTTP |
