---
type: C4 Component
title: Checkout validator
status: stable
groma:
  id: checkout-validator
  parent: checkout
  group: Core
  code:
    - scanner: typescript
      file: src/orders/checkout/validator.ts
      symbol: validator
    - scanner: typescript
      file: src/orders/checkout/validator-1.ts
      symbol: validator
    - scanner: typescript
      file: src/orders/checkout/validator-2.ts
      symbol: validator
    - scanner: typescript
      file: src/orders/checkout/validator-3.ts
      symbol: validator
    - scanner: typescript
      file: src/orders/checkout/validator-4.ts
      symbol: validator
---

Checkout validator of Checkout.
