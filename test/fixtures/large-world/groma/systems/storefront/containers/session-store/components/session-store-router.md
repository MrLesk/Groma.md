---
type: C4 Component
title: Session Store router
status: stable
groma:
  id: session-store-router
  parent: session-store
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/session-store/router.ts
      symbol: router
    - scanner: typescript
      file: src/storefront/session-store/router-1.ts
      symbol: router
---

Session Store router of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [session-store-session](session-store-session.md) | Calls session | HTTP |
| [session-store-cache](session-store-cache.md) | Reads cache | HTTP |
