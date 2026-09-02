---
type: C4 Component
title: Pricing router
status: stable
groma:
  id: pricing-router
  parent: pricing
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/pricing/router.ts
      symbol: router
    - scanner: typescript
      file: src/catalog/pricing/router-1.ts
      symbol: router
---

Pricing router of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-session](pricing-session.md) | Calls session | HTTP |
| [pricing-cache](pricing-cache.md) | Reads cache | HTTP |
