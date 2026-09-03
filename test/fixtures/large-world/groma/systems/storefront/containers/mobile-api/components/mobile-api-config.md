---
type: C4 Component
title: Mobile Api config
status: stable
groma:
  id: mobile-api-config
  parent: mobile-api
  code:
    - scanner: typescript
      file: src/storefront/mobile-api/config.ts
      symbol: config
    - scanner: typescript
      file: src/storefront/mobile-api/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/storefront/mobile-api/config-2.ts
      symbol: config
---

Mobile Api config of Mobile Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [mobile-api-logger](mobile-api-logger.md) | Calls logger | HTTP |
| [mobile-api-client](mobile-api-client.md) | Reads client | HTTP |
