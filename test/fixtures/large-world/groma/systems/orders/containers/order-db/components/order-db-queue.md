---
type: C4 Component
title: Order Db queue
status: stable
groma:
  id: order-db-queue
  parent: order-db
  group: Support
  code:
    - scanner: typescript
      file: src/orders/order-db/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/orders/order-db/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/orders/order-db/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/orders/order-db/queue-3.ts
      symbol: queue
---

Order Db queue of Order Db.
