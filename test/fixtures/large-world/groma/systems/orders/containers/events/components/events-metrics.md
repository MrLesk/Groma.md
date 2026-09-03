---
type: C4 Component
title: Events metrics
status: stable
groma:
  id: events-metrics
  parent: events
  code:
    - scanner: typescript
      file: src/orders/events/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/orders/events/metrics-1.ts
      symbol: metrics
---

Events metrics of Events.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [events-config](events-config.md) | Calls config | HTTP |
| [events-logger](events-logger.md) | Reads logger | HTTP |
