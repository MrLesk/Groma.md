---
type: C4 Component
title: Pricing config
status: stable
groma:
  id: pricing-config
  parent: pricing
  code:
    - scanner: typescript
      file: src/catalog/pricing/config.ts
      symbol: config
    - scanner: typescript
      file: src/catalog/pricing/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/catalog/pricing/config-2.ts
      symbol: config
---

Pricing config of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-logger](pricing-logger.md) | Calls logger | HTTP |
| [pricing-client](pricing-client.md) | Reads client | HTTP |
