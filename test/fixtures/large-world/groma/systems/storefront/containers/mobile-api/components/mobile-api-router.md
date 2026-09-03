---
type: C4 Component
title: Mobile Api router
status: stable
groma:
  id: mobile-api-router
  parent: mobile-api
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/mobile-api/router.ts
      symbol: router
    - scanner: typescript
      file: src/storefront/mobile-api/router-1.ts
      symbol: router
---

Mobile Api router of Mobile Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [mobile-api-session](mobile-api-session.md) | Calls session | HTTP |
| [mobile-api-cache](mobile-api-cache.md) | Reads cache | HTTP |
