---
type: C4 Component
title: Product Db reader
status: stable
groma:
  id: product-db-reader
  parent: product-db
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/product-db/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/catalog/product-db/reader-1.ts
      symbol: reader
---

Product Db reader of Product Db.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [product-db-writer](product-db-writer.md) | Calls writer | HTTP |
| [product-db-queue](product-db-queue.md) | Reads queue | HTTP |
