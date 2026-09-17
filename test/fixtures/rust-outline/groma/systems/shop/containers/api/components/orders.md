---
type: C4 Component
title: Orders
status: stable
groma:
  id: orders
  parent: api
  code:
    - scanner: typescript
      file: web/orders.ts
    - scanner: rust
      file: src/orders.rs
      symbol: place_order
    - scanner: rust
      file: src/orders.rs
      symbol: load
---

Records orders.
