---
type: C4 Component
title: Catalog Api router
status: stable
groma:
  id: catalog-api-router
  parent: catalog-api
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/catalog-api/router.ts
      symbol: router
    - scanner: typescript
      file: src/catalog/catalog-api/router-1.ts
      symbol: router
---

Catalog Api router of Catalog Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [catalog-api-session](catalog-api-session.md) | Calls session | HTTP |
| [catalog-api-cache](catalog-api-cache.md) | Reads cache | HTTP |
