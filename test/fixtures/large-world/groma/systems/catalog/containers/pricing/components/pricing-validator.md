---
type: C4 Component
title: Pricing validator
status: stable
groma:
  id: pricing-validator
  parent: pricing
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/pricing/validator.ts
      symbol: validator
    - scanner: typescript
      file: src/catalog/pricing/validator-1.ts
      symbol: validator
    - scanner: typescript
      file: src/catalog/pricing/validator-2.ts
      symbol: validator
    - scanner: typescript
      file: src/catalog/pricing/validator-3.ts
      symbol: validator
    - scanner: typescript
      file: src/catalog/pricing/validator-4.ts
      symbol: validator
---

Pricing validator of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-mapper](pricing-mapper.md) | Calls mapper | HTTP |
| [pricing-reader](pricing-reader.md) | Reads reader | HTTP |
