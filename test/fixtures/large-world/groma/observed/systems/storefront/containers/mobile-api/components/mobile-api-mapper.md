---
type: C4 Component
title: Mobile Api mapper
status: stable
groma:
  id: mobile-api-mapper
  parent: mobile-api
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/mobile-api/mapper.ts
      symbol: mapper
---

Mobile Api mapper of Mobile Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [mobile-api-reader](mobile-api-reader.md) | Calls reader | HTTP |
| [mobile-api-writer](mobile-api-writer.md) | Reads writer | HTTP |
