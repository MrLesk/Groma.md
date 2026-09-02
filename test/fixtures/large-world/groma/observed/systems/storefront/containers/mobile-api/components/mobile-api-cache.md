---
type: C4 Component
title: Mobile Api cache
status: stable
groma:
  id: mobile-api-cache
  parent: mobile-api
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/mobile-api/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/storefront/mobile-api/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/storefront/mobile-api/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/storefront/mobile-api/cache-3.ts
      symbol: cache
---

Mobile Api cache of Mobile Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [mobile-api-validator](mobile-api-validator.md) | Calls validator | HTTP |
| [mobile-api-mapper](mobile-api-mapper.md) | Reads mapper | HTTP |
