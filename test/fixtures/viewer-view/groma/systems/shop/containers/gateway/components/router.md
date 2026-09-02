---
type: C4 Component
title: Router
status: stable
groma:
  id: router
  parent: gateway
---

Sends each request to its handler.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Orders](../../api/components/orders.md) | Forwards order requests | In-process call |
