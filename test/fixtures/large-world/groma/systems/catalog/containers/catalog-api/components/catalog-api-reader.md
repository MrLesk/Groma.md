---
type: C4 Component
title: Catalog Api reader
status: stable
groma:
  id: catalog-api-reader
  parent: catalog-api
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/catalog-api/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/catalog/catalog-api/reader-1.ts
      symbol: reader
---

Catalog Api reader of Catalog Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [catalog-api-writer](catalog-api-writer.md) | Calls writer | HTTP |
| [catalog-api-queue](catalog-api-queue.md) | Reads queue | HTTP |
