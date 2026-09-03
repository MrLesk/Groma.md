---
type: C4 Component
title: Search cache
status: stable
groma:
  id: search-cache
  parent: search
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/search/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/storefront/search/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/storefront/search/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/storefront/search/cache-3.ts
      symbol: cache
---

Search cache of Search.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [search-validator](search-validator.md) | Calls validator | HTTP |
| [search-mapper](search-mapper.md) | Reads mapper | HTTP |
