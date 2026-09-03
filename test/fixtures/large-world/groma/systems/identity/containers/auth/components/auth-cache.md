---
type: C4 Component
title: Auth cache
status: stable
groma:
  id: auth-cache
  parent: auth
  group: Core
  code:
    - scanner: typescript
      file: src/identity/auth/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/identity/auth/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/identity/auth/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/identity/auth/cache-3.ts
      symbol: cache
---

Auth cache of Auth.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [auth-validator](auth-validator.md) | Calls validator | HTTP |
| [auth-mapper](auth-mapper.md) | Reads mapper | HTTP |
