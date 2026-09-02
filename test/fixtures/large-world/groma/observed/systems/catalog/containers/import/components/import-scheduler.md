---
type: C4 Component
title: Import scheduler
status: stable
groma:
  id: import-scheduler
  parent: import
  code:
    - scanner: typescript
      file: src/catalog/import/scheduler.ts
      symbol: scheduler
---

Import scheduler of Import.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [import-metrics](import-metrics.md) | Calls metrics | HTTP |
| [import-config](import-config.md) | Reads config | HTTP |
