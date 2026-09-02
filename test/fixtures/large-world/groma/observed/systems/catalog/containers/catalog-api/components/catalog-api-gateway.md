---
type: C4 Component
title: Catalog Api gateway
status: stable
groma:
  id: catalog-api-gateway
  parent: catalog-api
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/catalog-api/gateway.ts
      symbol: gateway
---

Catalog Api gateway of Catalog Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [catalog-api-router](catalog-api-router.md) | Calls router | HTTP |
| [catalog-api-session](catalog-api-session.md) | Reads session | HTTP |
| [pricing-gateway](../../../../catalog/containers/pricing/components/pricing-gateway.md) | Forwards requests | HTTP |
