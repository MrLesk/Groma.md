---
type: C4 Component
title: Session Store session
status: stable
groma:
  id: session-store-session
  parent: session-store
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/session-store/session.ts
      symbol: session
    - scanner: typescript
      file: src/storefront/session-store/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/storefront/session-store/session-2.ts
      symbol: session
---

Session Store session of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [session-store-cache](session-store-cache.md) | Calls cache | HTTP |
| [session-store-validator](session-store-validator.md) | Reads validator | HTTP |
