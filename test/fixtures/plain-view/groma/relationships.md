---
type: Groma Relationships
title: Architecture relationships
---

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [Buyer](actors/buyer.md) | [Shop](systems/shop/system.md) | uses | Browser |
| [src/orders.ts](../src/orders.ts) | [src/stock.ts](../src/stock.ts) | talks to | Function call |
