---
type: Groma Relationships
title: Architecture relationships
---

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [Shop architect](actors/shop-architect.md) | [Api](systems/shop/containers/api/container.md) | Reviews the order rules | Browser |
| [Shop architect](actors/shop-architect.md) | [Order viewer](systems/shop/containers/order-viewer/container.md) | Watches orders arrive | Browser |
| [Shop operator](actors/shop-operator.md) | [Api](systems/shop/containers/api/container.md) | Places a correction | Browser |
| [Shop operator](actors/shop-operator.md) | [Order viewer](systems/shop/containers/order-viewer/container.md) | Watches orders arrive | Browser |
| [src/orders.ts](../src/orders.ts) | [src/order-page.ts](../src/order-page.ts) | Supplies placed orders | In-process data |
| [src/router.ts](../src/router.ts) | [src/orders.ts](../src/orders.ts) | Forwards order requests | In-process call |
| [src/stock-page.ts](../src/stock-page.ts) | [src/pricing.ts](../src/pricing.ts) | Reads the price list | In-process data |
| [Shop](systems/shop/system.md) | [Vault](externals/vault.md) | Stores takings | HTTPS |
