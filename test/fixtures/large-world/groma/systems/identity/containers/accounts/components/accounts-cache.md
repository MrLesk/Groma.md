---
type: C4 Component
title: Accounts cache
status: stable
groma:
  id: accounts-cache
  parent: accounts
  group: Core
  code:
    - scanner: typescript
      file: src/identity/accounts/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/identity/accounts/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/identity/accounts/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/identity/accounts/cache-3.ts
      symbol: cache
---

Accounts cache of Accounts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [accounts-validator](accounts-validator.md) | Calls validator | HTTP |
| [accounts-mapper](accounts-mapper.md) | Reads mapper | HTTP |
