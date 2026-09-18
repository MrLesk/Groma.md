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
    - scanner: java
      file: src/main/java/shop/Orders.java
      symbol: Orders
    - scanner: java
      file: src/main/java/shop/Orders.java
      symbol: Orders.place
    - scanner: java
      file: src/main/java/shop/Receipt.java
      symbol: Receipt
    - scanner: java
      file: src/main/java/Greeting.java
---

Records orders.
