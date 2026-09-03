---
type: C4 Component
title: Search reader
status: stable
groma:
  id: search-reader
  parent: search
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/search/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/storefront/search/reader-1.ts
      symbol: reader
---

Search reader of Search.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [search-writer](search-writer.md) | Calls writer | HTTP |
| [search-queue](search-queue.md) | Reads queue | HTTP |
