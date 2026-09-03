---
type: C4 Component
title: Events gateway
status: stable
groma:
  id: events-gateway
  parent: events
  group: Core
  code:
    - scanner: typescript
      file: src/orders/events/gateway.ts
      symbol: gateway
---

Events gateway of Events.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [events-router](events-router.md) | Calls router | HTTP |
| [events-session](events-session.md) | Reads session | HTTP |
| [catalog-api-gateway](../../../../catalog/containers/catalog-api/components/catalog-api-gateway.md) | Forwards requests | HTTP |
