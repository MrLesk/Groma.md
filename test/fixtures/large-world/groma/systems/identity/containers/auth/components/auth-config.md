---
type: C4 Component
title: Auth config
status: stable
groma:
  id: auth-config
  parent: auth
  code:
    - scanner: typescript
      file: src/identity/auth/config.ts
      symbol: config
    - scanner: typescript
      file: src/identity/auth/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/identity/auth/config-2.ts
      symbol: config
---

Auth config of Auth.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [auth-logger](auth-logger.md) | Calls logger | HTTP |
| [auth-client](auth-client.md) | Reads client | HTTP |
