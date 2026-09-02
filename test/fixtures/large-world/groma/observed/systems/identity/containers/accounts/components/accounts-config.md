---
type: C4 Component
title: Accounts config
status: stable
groma:
  id: accounts-config
  parent: accounts
  code:
    - scanner: typescript
      file: src/identity/accounts/config.ts
      symbol: config
    - scanner: typescript
      file: src/identity/accounts/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/identity/accounts/config-2.ts
      symbol: config
---

Accounts config of Accounts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [accounts-logger](accounts-logger.md) | Calls logger | HTTP |
| [accounts-client](accounts-client.md) | Reads client | HTTP |
