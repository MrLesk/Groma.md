---
type: C4 Component
title: Import config
status: stable
groma:
  id: import-config
  parent: import
  code:
    - scanner: typescript
      file: src/catalog/import/config.ts
      symbol: config
    - scanner: typescript
      file: src/catalog/import/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/catalog/import/config-2.ts
      symbol: config
---

Import config of Import.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [import-logger](import-logger.md) | Calls logger | HTTP |
| [import-client](import-client.md) | Reads client | HTTP |
