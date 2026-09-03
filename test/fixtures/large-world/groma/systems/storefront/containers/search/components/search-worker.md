---
type: C4 Component
title: Search worker
status: stable
groma:
  id: search-worker
  parent: search
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/search/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/search/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/search/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/search/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/search/worker-4.ts
      symbol: worker
---

Search worker of Search.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [search-scheduler](search-scheduler.md) | Calls scheduler | HTTP |
| [search-metrics](search-metrics.md) | Reads metrics | HTTP |
