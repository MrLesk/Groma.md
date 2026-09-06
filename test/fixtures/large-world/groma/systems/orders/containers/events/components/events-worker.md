---
type: C4 Component
title: Events worker
status: stable
groma:
  id: events-worker
  parent: events
  group: Support
  code:
    - scanner: typescript
      file: src/orders/events/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/orders/events/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/orders/events/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/orders/events/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/orders/events/worker-4.ts
      symbol: worker
---

Events worker of Events.
