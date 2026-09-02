---
type: C4 Component
title: Search session
status: stable
groma:
  id: search-session
  parent: search
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/search/session.ts
      symbol: session
    - scanner: typescript
      file: src/storefront/search/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/storefront/search/session-2.ts
      symbol: session
---

Search session of Search.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [search-cache](search-cache.md) | Calls cache | HTTP |
| [search-validator](search-validator.md) | Reads validator | HTTP |
