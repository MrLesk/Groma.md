---
type: C4 Component
title: Product Db mapper
status: stable
groma:
  id: product-db-mapper
  parent: product-db
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/product-db/mapper.ts
      symbol: mapper
---

Product Db mapper of Product Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [product-db-reader](product-db-reader.md) | Calls reader | HTTP |
| [product-db-writer](product-db-writer.md) | Reads writer | HTTP |
