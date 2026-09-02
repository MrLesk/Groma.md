---
type: C4 Component
title: Cdn Edge scheduler
status: stable
groma:
  id: cdn-edge-scheduler
  parent: cdn-edge
  code:
    - scanner: typescript
      file: src/storefront/cdn-edge/scheduler.ts
      symbol: scheduler
---

Cdn Edge scheduler of Cdn Edge.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cdn-edge-metrics](cdn-edge-metrics.md) | Calls metrics | HTTP |
| [cdn-edge-config](cdn-edge-config.md) | Reads config | HTTP |
