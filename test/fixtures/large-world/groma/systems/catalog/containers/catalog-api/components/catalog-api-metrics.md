---
type: C4 Component
title: Catalog Api metrics
status: stable
groma:
  id: catalog-api-metrics
  parent: catalog-api
  code:
    - scanner: typescript
      file: src/catalog/catalog-api/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/catalog/catalog-api/metrics-1.ts
      symbol: metrics
---

Catalog Api metrics of Catalog Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [catalog-api-config](catalog-api-config.md) | Calls config | HTTP |
| [catalog-api-logger](catalog-api-logger.md) | Reads logger | HTTP |
