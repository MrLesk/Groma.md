---
type: C4 Component
title: Pricing logger
status: stable
groma:
  id: pricing-logger
  parent: pricing
  code:
    - scanner: typescript
      file: src/catalog/pricing/logger.ts
      symbol: logger
    - scanner: typescript
      file: src/catalog/pricing/logger-1.ts
      symbol: logger
    - scanner: typescript
      file: src/catalog/pricing/logger-2.ts
      symbol: logger
    - scanner: typescript
      file: src/catalog/pricing/logger-3.ts
      symbol: logger
---

Pricing logger of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-client](pricing-client.md) | Calls client | HTTP |
