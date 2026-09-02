---
type: C4 Component
title: Catalog Api config
status: stable
groma:
  id: catalog-api-config
  parent: catalog-api
  code:
    - scanner: typescript
      file: src/catalog/catalog-api/config.ts
      symbol: config
    - scanner: typescript
      file: src/catalog/catalog-api/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/catalog/catalog-api/config-2.ts
      symbol: config
---

Catalog Api config of Catalog Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [catalog-api-logger](catalog-api-logger.md) | Calls logger | HTTP |
| [catalog-api-client](catalog-api-client.md) | Reads client | HTTP |
