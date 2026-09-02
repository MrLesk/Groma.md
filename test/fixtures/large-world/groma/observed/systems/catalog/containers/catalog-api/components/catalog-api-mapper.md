---
type: C4 Component
title: Catalog Api mapper
status: stable
groma:
  id: catalog-api-mapper
  parent: catalog-api
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/catalog-api/mapper.ts
      symbol: mapper
---

Catalog Api mapper of Catalog Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [catalog-api-reader](catalog-api-reader.md) | Calls reader | HTTP |
| [catalog-api-writer](catalog-api-writer.md) | Reads writer | HTTP |
