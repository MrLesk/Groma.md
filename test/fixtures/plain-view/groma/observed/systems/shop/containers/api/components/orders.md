---
id: orders
kind: component
parent: api
code:
  - scanner: typescript
    file: src/orders.ts
    symbol: placeOrder
  - scanner: routes
    file: src/routes/orders.ts
---

# Orders

Owns the order lifecycle.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Stock](stock.md) | talks to | Function call |
