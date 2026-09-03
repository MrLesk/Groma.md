---
type: C4 Component
title: Search gateway
status: stable
groma:
  id: search-gateway
  parent: search
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/search/gateway.ts
      symbol: gateway
---

Search gateway of Search.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [search-router](search-router.md) | Calls router | HTTP |
| [search-session](search-session.md) | Reads session | HTTP |
| [cdn-edge-gateway](../../../../storefront/containers/cdn-edge/components/cdn-edge-gateway.md) | Forwards requests | HTTP |
