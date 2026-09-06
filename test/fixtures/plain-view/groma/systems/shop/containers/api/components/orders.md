---
type: C4 Component
title: Orders
description: Processes submitted orders.
status: stable
tags: [fulfilment]
groma:
  id: orders
  parent: api
  group: Fulfilment
  technology: TypeScript
  code:
    - scanner: typescript
      file: src/orders.ts
      symbol: placeOrder
    - scanner: routes
      file: src/routes/orders.ts
---

Owns the order lifecycle.

## Requirements

Keep one order identifier through submission and fulfilment.

## Technology

The routes call the order lifecycle implementation.

## Notes

Review [the source](../../../../../../src/orders.ts) before changing the lifecycle.
