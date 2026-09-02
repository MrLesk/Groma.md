---
type: C4 Component
title: Pricing reader
status: stable
groma:
  id: pricing-reader
  parent: pricing
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/pricing/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/catalog/pricing/reader-1.ts
      symbol: reader
---

Pricing reader of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-writer](pricing-writer.md) | Calls writer | HTTP |
| [pricing-queue](pricing-queue.md) | Reads queue | HTTP |
