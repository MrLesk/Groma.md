---
type: C4 Component
title: Pricing worker
status: stable
groma:
  id: pricing-worker
  parent: pricing
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/pricing/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/pricing/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/pricing/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/pricing/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/pricing/worker-4.ts
      symbol: worker
---

Pricing worker of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-scheduler](pricing-scheduler.md) | Calls scheduler | HTTP |
| [pricing-metrics](pricing-metrics.md) | Reads metrics | HTTP |
