---
type: C4 Component
title: Mobile Api logger
status: stable
groma:
  id: mobile-api-logger
  parent: mobile-api
  code:
    - scanner: typescript
      file: src/storefront/mobile-api/logger.ts
      symbol: logger
    - scanner: typescript
      file: src/storefront/mobile-api/logger-1.ts
      symbol: logger
    - scanner: typescript
      file: src/storefront/mobile-api/logger-2.ts
      symbol: logger
    - scanner: typescript
      file: src/storefront/mobile-api/logger-3.ts
      symbol: logger
---

Mobile Api logger of Mobile Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [mobile-api-client](mobile-api-client.md) | Calls client | HTTP |
