---
id: orders
kind: component
parent: api
code:
  - scanner: typescript
    file: src/inventory-orders.ts
---

# Inventory-aware orders

Places an order only after inventory is reserved.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Payments](../../../../payments/system.md) | Authorizes reserved orders | HTTPS |
