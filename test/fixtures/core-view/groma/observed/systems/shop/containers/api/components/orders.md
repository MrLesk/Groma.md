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

Places and tracks customer orders.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Payments](../../../../payments/system.md) | Requests payment authorization | HTTPS |
