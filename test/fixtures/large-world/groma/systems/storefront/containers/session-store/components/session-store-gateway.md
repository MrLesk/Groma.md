---
type: C4 Component
title: Session Store gateway
status: stable
groma:
  id: session-store-gateway
  parent: session-store
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/session-store/gateway.ts
      symbol: gateway
---

Session Store gateway of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [session-store-router](session-store-router.md) | Calls router | HTTP |
| [session-store-session](session-store-session.md) | Reads session | HTTP |
| [checkout-gateway](../../../../orders/containers/checkout/components/checkout-gateway.md) | Forwards requests | HTTP |
