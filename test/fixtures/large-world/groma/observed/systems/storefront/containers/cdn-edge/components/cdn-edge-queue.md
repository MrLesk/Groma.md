---
type: C4 Component
title: Cdn Edge queue
status: stable
groma:
  id: cdn-edge-queue
  parent: cdn-edge
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/cdn-edge/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/storefront/cdn-edge/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/storefront/cdn-edge/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/storefront/cdn-edge/queue-3.ts
      symbol: queue
---

Cdn Edge queue of Cdn Edge.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cdn-edge-worker](cdn-edge-worker.md) | Calls worker | HTTP |
| [cdn-edge-scheduler](cdn-edge-scheduler.md) | Reads scheduler | HTTP |
