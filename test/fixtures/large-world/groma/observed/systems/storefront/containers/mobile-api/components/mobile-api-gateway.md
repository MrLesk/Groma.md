---
type: C4 Component
title: Mobile Api gateway
status: stable
groma:
  id: mobile-api-gateway
  parent: mobile-api
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/mobile-api/gateway.ts
      symbol: gateway
---

Mobile Api gateway of Mobile Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [mobile-api-router](mobile-api-router.md) | Calls router | HTTP |
| [mobile-api-session](mobile-api-session.md) | Reads session | HTTP |
| [search-gateway](../../../../storefront/containers/search/components/search-gateway.md) | Forwards requests | HTTP |
