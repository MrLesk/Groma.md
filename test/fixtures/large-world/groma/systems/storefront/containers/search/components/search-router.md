---
type: C4 Component
title: Search router
status: stable
groma:
  id: search-router
  parent: search
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/search/router.ts
      symbol: router
    - scanner: typescript
      file: src/storefront/search/router-1.ts
      symbol: router
---

Search router of Search.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [search-session](search-session.md) | Calls session | HTTP |
| [search-cache](search-cache.md) | Reads cache | HTTP |
