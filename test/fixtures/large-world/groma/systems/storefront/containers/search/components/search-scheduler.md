---
type: C4 Component
title: Search scheduler
status: stable
groma:
  id: search-scheduler
  parent: search
  code:
    - scanner: typescript
      file: src/storefront/search/scheduler.ts
      symbol: scheduler
---

Search scheduler of Search.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [search-metrics](search-metrics.md) | Calls metrics | HTTP |
| [search-config](search-config.md) | Reads config | HTTP |
