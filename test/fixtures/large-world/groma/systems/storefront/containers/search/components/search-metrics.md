---
type: C4 Component
title: Search metrics
status: stable
groma:
  id: search-metrics
  parent: search
  code:
    - scanner: typescript
      file: src/storefront/search/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/storefront/search/metrics-1.ts
      symbol: metrics
---

Search metrics of Search.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [search-config](search-config.md) | Calls config | HTTP |
| [search-logger](search-logger.md) | Reads logger | HTTP |
