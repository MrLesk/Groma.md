---
type: C4 Component
title: Import metrics
status: stable
groma:
  id: import-metrics
  parent: import
  code:
    - scanner: typescript
      file: src/catalog/import/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/catalog/import/metrics-1.ts
      symbol: metrics
---

Import metrics of Import.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [import-config](import-config.md) | Calls config | HTTP |
| [import-logger](import-logger.md) | Reads logger | HTTP |
