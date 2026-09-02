---
type: C4 Component
title: Mobile Api metrics
status: stable
groma:
  id: mobile-api-metrics
  parent: mobile-api
  code:
    - scanner: typescript
      file: src/storefront/mobile-api/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/storefront/mobile-api/metrics-1.ts
      symbol: metrics
---

Mobile Api metrics of Mobile Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [mobile-api-config](mobile-api-config.md) | Calls config | HTTP |
| [mobile-api-logger](mobile-api-logger.md) | Reads logger | HTTP |
