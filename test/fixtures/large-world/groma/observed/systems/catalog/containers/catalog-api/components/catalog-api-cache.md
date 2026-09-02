---
type: C4 Component
title: Catalog Api cache
status: stable
groma:
  id: catalog-api-cache
  parent: catalog-api
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/catalog-api/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/catalog/catalog-api/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/catalog/catalog-api/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/catalog/catalog-api/cache-3.ts
      symbol: cache
---

Catalog Api cache of Catalog Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [catalog-api-validator](catalog-api-validator.md) | Calls validator | HTTP |
| [catalog-api-mapper](catalog-api-mapper.md) | Reads mapper | HTTP |
