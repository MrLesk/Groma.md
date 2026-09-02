---
type: C4 Component
title: Pricing session
status: stable
groma:
  id: pricing-session
  parent: pricing
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/pricing/session.ts
      symbol: session
    - scanner: typescript
      file: src/catalog/pricing/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/catalog/pricing/session-2.ts
      symbol: session
---

Pricing session of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-cache](pricing-cache.md) | Calls cache | HTTP |
| [pricing-validator](pricing-validator.md) | Reads validator | HTTP |
