---
type: C4 Component
title: Pricing mapper
status: stable
groma:
  id: pricing-mapper
  parent: pricing
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/pricing/mapper.ts
      symbol: mapper
---

Pricing mapper of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-reader](pricing-reader.md) | Calls reader | HTTP |
| [pricing-writer](pricing-writer.md) | Reads writer | HTTP |
