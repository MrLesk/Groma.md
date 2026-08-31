---
type: C4 Component
title: Orders
status: stable
groma:
  id: orders
  parent: api
  code:
    - scanner: typescript
      file: src/orders.ts
      symbol: placeOrder
---

Owns the order lifecycle.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Stock](stock.md) | talks to | Function call |
