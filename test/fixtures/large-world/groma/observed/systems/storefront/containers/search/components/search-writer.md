---
type: C4 Component
title: Search writer
status: stable
groma:
  id: search-writer
  parent: search
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/search/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/storefront/search/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/storefront/search/writer-2.ts
      symbol: writer
---

Search writer of Search.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [search-queue](search-queue.md) | Calls queue | HTTP |
| [search-worker](search-worker.md) | Reads worker | HTTP |
