---
type: C4 Component
title: Pricing scheduler
status: stable
groma:
  id: pricing-scheduler
  parent: pricing
  code:
    - scanner: typescript
      file: src/catalog/pricing/scheduler.ts
      symbol: scheduler
---

Pricing scheduler of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-metrics](pricing-metrics.md) | Calls metrics | HTTP |
| [pricing-config](pricing-config.md) | Reads config | HTTP |
