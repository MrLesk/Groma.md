---
type: C4 Component
title: Mobile Api worker
status: stable
groma:
  id: mobile-api-worker
  parent: mobile-api
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/mobile-api/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/mobile-api/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/mobile-api/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/mobile-api/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/mobile-api/worker-4.ts
      symbol: worker
---

Mobile Api worker of Mobile Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [mobile-api-scheduler](mobile-api-scheduler.md) | Calls scheduler | HTTP |
| [mobile-api-metrics](mobile-api-metrics.md) | Reads metrics | HTTP |
