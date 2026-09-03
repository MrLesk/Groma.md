---
type: C4 Component
title: Events queue
status: stable
groma:
  id: events-queue
  parent: events
  group: Support
  code:
    - scanner: typescript
      file: src/orders/events/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/orders/events/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/orders/events/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/orders/events/queue-3.ts
      symbol: queue
---

Events queue of Events.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [events-worker](events-worker.md) | Calls worker | HTTP |
| [events-scheduler](events-scheduler.md) | Reads scheduler | HTTP |
