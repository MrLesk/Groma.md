---
type: C4 Component
title: Order Service mapper
status: stable
groma:
  id: order-service-mapper
  parent: order-service
  group: Support
  code:
    - scanner: typescript
      file: src/orders/order-service/mapper.ts
      symbol: mapper
---

Order Service mapper of Order Service.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [order-service-reader](order-service-reader.md) | Calls reader | HTTP |
| [order-service-writer](order-service-writer.md) | Reads writer | HTTP |
