---
type: C4 Component
title: Cdn Edge metrics
status: stable
groma:
  id: cdn-edge-metrics
  parent: cdn-edge
  code:
    - scanner: typescript
      file: src/storefront/cdn-edge/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/storefront/cdn-edge/metrics-1.ts
      symbol: metrics
---

Cdn Edge metrics of Cdn Edge.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cdn-edge-config](cdn-edge-config.md) | Calls config | HTTP |
| [cdn-edge-logger](cdn-edge-logger.md) | Reads logger | HTTP |
