---
type: C4 Component
title: Session Store config
status: stable
groma:
  id: session-store-config
  parent: session-store
  code:
    - scanner: typescript
      file: src/storefront/session-store/config.ts
      symbol: config
    - scanner: typescript
      file: src/storefront/session-store/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/storefront/session-store/config-2.ts
      symbol: config
---

Session Store config of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [session-store-logger](session-store-logger.md) | Calls logger | HTTP |
| [session-store-client](session-store-client.md) | Reads client | HTTP |
