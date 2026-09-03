---
type: C4 Component
title: Accounts gateway
status: stable
groma:
  id: accounts-gateway
  parent: accounts
  group: Core
  code:
    - scanner: typescript
      file: src/identity/accounts/gateway.ts
      symbol: gateway
---

Accounts gateway of Accounts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [accounts-router](accounts-router.md) | Calls router | HTTP |
| [accounts-session](accounts-session.md) | Reads session | HTTP |
| [auth-gateway](../../../../identity/containers/auth/components/auth-gateway.md) | Forwards requests | HTTP |
