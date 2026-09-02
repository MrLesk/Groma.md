---
type: C4 Component
title: Auth gateway
status: stable
groma:
  id: auth-gateway
  parent: auth
  group: Core
  code:
    - scanner: typescript
      file: src/identity/auth/gateway.ts
      symbol: gateway
---

Auth gateway of Auth.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [auth-router](auth-router.md) | Calls router | HTTP |
| [auth-session](auth-session.md) | Reads session | HTTP |
| [directory-gateway](../../../../identity/containers/directory/components/directory-gateway.md) | Forwards requests | HTTP |
