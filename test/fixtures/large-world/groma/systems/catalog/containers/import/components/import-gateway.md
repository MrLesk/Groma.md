---
type: C4 Component
title: Import gateway
status: stable
groma:
  id: import-gateway
  parent: import
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/import/gateway.ts
      symbol: gateway
---

Import gateway of Import.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [import-router](import-router.md) | Calls router | HTTP |
| [import-session](import-session.md) | Reads session | HTTP |
| [media-gateway](../../../../catalog/containers/media/components/media-gateway.md) | Forwards requests | HTTP |
