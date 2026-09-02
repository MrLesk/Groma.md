---
type: C4 Component
title: Import router
status: stable
groma:
  id: import-router
  parent: import
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/import/router.ts
      symbol: router
    - scanner: typescript
      file: src/catalog/import/router-1.ts
      symbol: router
---

Import router of Import.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [import-session](import-session.md) | Calls session | HTTP |
| [import-cache](import-cache.md) | Reads cache | HTTP |
