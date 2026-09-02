---
type: C4 Component
title: Catalog Api worker
status: stable
groma:
  id: catalog-api-worker
  parent: catalog-api
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/catalog-api/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/catalog-api/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/catalog-api/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/catalog-api/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/catalog-api/worker-4.ts
      symbol: worker
---

Catalog Api worker of Catalog Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [catalog-api-scheduler](catalog-api-scheduler.md) | Calls scheduler | HTTP |
| [catalog-api-metrics](catalog-api-metrics.md) | Reads metrics | HTTP |
