---
type: C4 Actor
title: Merchant
status: stable
groma:
  id: merchant
---

Merchant of the shop.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [container](../systems/storefront/containers/mobile-api/container.md) | Uses mobile-api | HTTP |
| [container](../systems/orders/containers/cart/container.md) | Uses cart | HTTP |
| [container](../systems/catalog/containers/pricing/container.md) | Uses pricing | HTTP |
| [container](../systems/identity/containers/auth/container.md) | Uses auth | HTTP |
