---
type: C4 Component
title: Pricing metrics
status: stable
groma:
  id: pricing-metrics
  parent: pricing
  code:
    - scanner: typescript
      file: src/catalog/pricing/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/catalog/pricing/metrics-1.ts
      symbol: metrics
---

Pricing metrics of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-config](pricing-config.md) | Calls config | HTTP |
| [pricing-logger](pricing-logger.md) | Reads logger | HTTP |
