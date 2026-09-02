---
type: C4 Component
title: Auth session
status: stable
groma:
  id: auth-session
  parent: auth
  group: Core
  code:
    - scanner: typescript
      file: src/identity/auth/session.ts
      symbol: session
    - scanner: typescript
      file: src/identity/auth/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/identity/auth/session-2.ts
      symbol: session
---

Auth session of Auth.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [auth-cache](auth-cache.md) | Calls cache | HTTP |
| [auth-validator](auth-validator.md) | Reads validator | HTTP |
