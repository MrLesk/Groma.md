---
type: C4 Component
title: Pricing queue
status: stable
groma:
  id: pricing-queue
  parent: pricing
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/pricing/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/catalog/pricing/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/catalog/pricing/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/catalog/pricing/queue-3.ts
      symbol: queue
---

Pricing queue of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-worker](pricing-worker.md) | Calls worker | HTTP |
| [pricing-scheduler](pricing-scheduler.md) | Reads scheduler | HTTP |
