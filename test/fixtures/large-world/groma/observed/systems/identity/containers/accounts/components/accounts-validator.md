---
type: C4 Component
title: Accounts validator
status: stable
groma:
  id: accounts-validator
  parent: accounts
  group: Core
  code:
    - scanner: typescript
      file: src/identity/accounts/validator.ts
      symbol: validator
    - scanner: typescript
      file: src/identity/accounts/validator-1.ts
      symbol: validator
    - scanner: typescript
      file: src/identity/accounts/validator-2.ts
      symbol: validator
    - scanner: typescript
      file: src/identity/accounts/validator-3.ts
      symbol: validator
    - scanner: typescript
      file: src/identity/accounts/validator-4.ts
      symbol: validator
---

Accounts validator of Accounts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [accounts-mapper](accounts-mapper.md) | Calls mapper | HTTP |
| [accounts-reader](accounts-reader.md) | Reads reader | HTTP |
