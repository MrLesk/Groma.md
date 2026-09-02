---
type: C4 Component
title: Accounts mapper
status: stable
groma:
  id: accounts-mapper
  parent: accounts
  group: Support
  code:
    - scanner: typescript
      file: src/identity/accounts/mapper.ts
      symbol: mapper
---

Accounts mapper of Accounts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [accounts-reader](accounts-reader.md) | Calls reader | HTTP |
| [accounts-writer](accounts-writer.md) | Reads writer | HTTP |
