---
type: Groma Relationships
title: Architecture relationships
---

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/inventory.ts](../src/inventory.ts) | [src/orders.ts](../src/orders.ts) | Reports reserved stock | Function call |
| [Orders](systems/shop/containers/api/components/orders.md) | [Payments](externals/payments.md) | Requests payment authorization | HTTPS |
