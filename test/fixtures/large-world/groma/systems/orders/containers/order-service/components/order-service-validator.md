---
type: C4 Component
title: Order Service validator
status: stable
groma:
  id: order-service-validator
  parent: order-service
  group: Core
  code:
    - scanner: typescript
      file: src/orders/order-service/validator.ts
      symbol: validator
    - scanner: typescript
      file: src/orders/order-service/validator-1.ts
      symbol: validator
    - scanner: typescript
      file: src/orders/order-service/validator-2.ts
      symbol: validator
    - scanner: typescript
      file: src/orders/order-service/validator-3.ts
      symbol: validator
    - scanner: typescript
      file: src/orders/order-service/validator-4.ts
      symbol: validator
---

Order Service validator of Order Service.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-service-mapper](order-service-mapper.md) | Calls mapper | HTTP |
| [order-service-reader](order-service-reader.md) | Reads reader | HTTP |
