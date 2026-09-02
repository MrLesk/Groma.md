---
type: C4 Component
title: Accounts session
status: stable
groma:
  id: accounts-session
  parent: accounts
  group: Core
  code:
    - scanner: typescript
      file: src/identity/accounts/session.ts
      symbol: session
    - scanner: typescript
      file: src/identity/accounts/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/identity/accounts/session-2.ts
      symbol: session
---

Accounts session of Accounts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [accounts-cache](accounts-cache.md) | Calls cache | HTTP |
| [accounts-validator](accounts-validator.md) | Reads validator | HTTP |
