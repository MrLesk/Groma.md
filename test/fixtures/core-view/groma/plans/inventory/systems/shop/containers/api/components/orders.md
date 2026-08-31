---
type: C4 Component
title: Inventory-aware orders
status: draft
groma:
  id: orders
  parent: api
  code:
    - scanner: typescript
      file: src/inventory-orders.ts
---

Places an order only after inventory is reserved.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Payments](../../../../payments/system.md) | Authorizes reserved orders | HTTPS |
