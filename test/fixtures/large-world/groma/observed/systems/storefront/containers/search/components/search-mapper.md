---
type: C4 Component
title: Search mapper
status: stable
groma:
  id: search-mapper
  parent: search
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/search/mapper.ts
      symbol: mapper
---

Search mapper of Search.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [search-reader](search-reader.md) | Calls reader | HTTP |
| [search-writer](search-writer.md) | Reads writer | HTTP |
