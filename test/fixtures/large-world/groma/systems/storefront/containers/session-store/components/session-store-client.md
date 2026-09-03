---
type: C4 Component
title: Session Store client
status: stable
groma:
  id: session-store-client
  parent: session-store
  code:
    - scanner: typescript
      file: src/storefront/session-store/client.ts
      symbol: client
    - scanner: typescript
      file: src/storefront/session-store/client-1.ts
      symbol: client
    - scanner: typescript
      file: src/storefront/session-store/client-2.ts
      symbol: client
    - scanner: typescript
      file: src/storefront/session-store/client-3.ts
      symbol: client
    - scanner: typescript
      file: src/storefront/session-store/client-4.ts
      symbol: client
---

Session Store client of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [payments](../../../../../externals/payments.md) | Charges cards | HTTP |
