---
type: C4 Component
title: Catalog Api session
status: stable
groma:
  id: catalog-api-session
  parent: catalog-api
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/catalog-api/session.ts
      symbol: session
    - scanner: typescript
      file: src/catalog/catalog-api/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/catalog/catalog-api/session-2.ts
      symbol: session
---

Catalog Api session of Catalog Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [catalog-api-cache](catalog-api-cache.md) | Calls cache | HTTP |
| [catalog-api-validator](catalog-api-validator.md) | Reads validator | HTTP |
