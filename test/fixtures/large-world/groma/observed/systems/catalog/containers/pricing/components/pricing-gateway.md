---
type: C4 Component
title: Pricing gateway
status: stable
groma:
  id: pricing-gateway
  parent: pricing
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/pricing/gateway.ts
      symbol: gateway
---

Pricing gateway of Pricing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [pricing-router](pricing-router.md) | Calls router | HTTP |
| [pricing-session](pricing-session.md) | Reads session | HTTP |
| [product-db-gateway](../../../../catalog/containers/product-db/components/product-db-gateway.md) | Forwards requests | HTTP |
