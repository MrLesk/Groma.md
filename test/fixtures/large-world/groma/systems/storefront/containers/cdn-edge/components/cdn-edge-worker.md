---
type: C4 Component
title: Cdn Edge worker
status: stable
groma:
  id: cdn-edge-worker
  parent: cdn-edge
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/cdn-edge/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/cdn-edge/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/cdn-edge/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/cdn-edge/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/cdn-edge/worker-4.ts
      symbol: worker
---

Cdn Edge worker of Cdn Edge.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cdn-edge-scheduler](cdn-edge-scheduler.md) | Calls scheduler | HTTP |
| [cdn-edge-metrics](cdn-edge-metrics.md) | Reads metrics | HTTP |
