---
type: C4 Component
title: Pricing writer
status: stable
groma:
  id: pricing-writer
  parent: pricing
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/pricing/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/catalog/pricing/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/catalog/pricing/writer-2.ts
      symbol: writer
---

Pricing writer of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-queue](pricing-queue.md) | Calls queue | HTTP |
| [pricing-worker](pricing-worker.md) | Reads worker | HTTP |
