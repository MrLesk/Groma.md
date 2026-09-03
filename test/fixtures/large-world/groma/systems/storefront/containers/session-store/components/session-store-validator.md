---
type: C4 Component
title: Session Store validator
status: stable
groma:
  id: session-store-validator
  parent: session-store
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/session-store/validator.ts
      symbol: validator
    - scanner: typescript
      file: src/storefront/session-store/validator-1.ts
      symbol: validator
    - scanner: typescript
      file: src/storefront/session-store/validator-2.ts
      symbol: validator
    - scanner: typescript
      file: src/storefront/session-store/validator-3.ts
      symbol: validator
    - scanner: typescript
      file: src/storefront/session-store/validator-4.ts
      symbol: validator
---

Session Store validator of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [session-store-mapper](session-store-mapper.md) | Calls mapper | HTTP |
| [session-store-reader](session-store-reader.md) | Reads reader | HTTP |
