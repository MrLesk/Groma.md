---
type: C4 Component
title: Session Store queue
status: stable
groma:
  id: session-store-queue
  parent: session-store
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/session-store/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/storefront/session-store/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/storefront/session-store/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/storefront/session-store/queue-3.ts
      symbol: queue
---

Session Store queue of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [session-store-worker](session-store-worker.md) | Calls worker | HTTP |
| [session-store-scheduler](session-store-scheduler.md) | Reads scheduler | HTTP |
