---
type: C4 Actor
title: Shopper
status: stable
groma:
  id: shopper
---

Shopper of the shop.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [container](../systems/storefront/containers/web-app/container.md) | Uses web-app | HTTP |
| [container](../systems/orders/containers/checkout/container.md) | Uses checkout | HTTP |
| [container](../systems/catalog/containers/catalog-api/container.md) | Uses catalog-api | HTTP |
| [container](../systems/identity/containers/accounts/container.md) | Uses accounts | HTTP |
