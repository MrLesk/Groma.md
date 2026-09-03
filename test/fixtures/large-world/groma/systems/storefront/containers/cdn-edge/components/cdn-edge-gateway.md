---
type: C4 Component
title: Cdn Edge gateway
status: stable
groma:
  id: cdn-edge-gateway
  parent: cdn-edge
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/cdn-edge/gateway.ts
      symbol: gateway
---

Cdn Edge gateway of Cdn Edge.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cdn-edge-router](cdn-edge-router.md) | Calls router | HTTP |
| [cdn-edge-session](cdn-edge-session.md) | Reads session | HTTP |
| [session-store-gateway](../../../../storefront/containers/session-store/components/session-store-gateway.md) | Forwards requests | HTTP |
