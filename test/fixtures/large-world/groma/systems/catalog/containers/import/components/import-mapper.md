---
type: C4 Component
title: Import mapper
status: stable
groma:
  id: import-mapper
  parent: import
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/import/mapper.ts
      symbol: mapper
---

Import mapper of Import.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [import-reader](import-reader.md) | Calls reader | HTTP |
| [import-writer](import-writer.md) | Reads writer | HTTP |
