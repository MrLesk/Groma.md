---
type: C4 Component
title: Session Store worker
status: stable
groma:
  id: session-store-worker
  parent: session-store
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/session-store/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/session-store/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/session-store/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/session-store/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/session-store/worker-4.ts
      symbol: worker
---

Session Store worker of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [session-store-scheduler](session-store-scheduler.md) | Calls scheduler | HTTP |
| [session-store-metrics](session-store-metrics.md) | Reads metrics | HTTP |
