---
type: C4 Component
title: Accounts reader
status: stable
groma:
  id: accounts-reader
  parent: accounts
  group: Support
  code:
    - scanner: typescript
      file: src/identity/accounts/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/identity/accounts/reader-1.ts
      symbol: reader
---

Accounts reader of Accounts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [accounts-writer](accounts-writer.md) | Calls writer | HTTP |
| [accounts-queue](accounts-queue.md) | Reads queue | HTTP |
