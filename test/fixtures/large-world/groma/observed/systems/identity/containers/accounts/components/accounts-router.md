---
type: C4 Component
title: Accounts router
status: stable
groma:
  id: accounts-router
  parent: accounts
  group: Core
  code:
    - scanner: typescript
      file: src/identity/accounts/router.ts
      symbol: router
    - scanner: typescript
      file: src/identity/accounts/router-1.ts
      symbol: router
---

Accounts router of Accounts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [accounts-session](accounts-session.md) | Calls session | HTTP |
| [accounts-cache](accounts-cache.md) | Reads cache | HTTP |
