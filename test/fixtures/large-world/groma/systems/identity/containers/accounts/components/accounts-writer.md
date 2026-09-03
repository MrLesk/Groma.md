---
type: C4 Component
title: Accounts writer
status: stable
groma:
  id: accounts-writer
  parent: accounts
  group: Support
  code:
    - scanner: typescript
      file: src/identity/accounts/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/identity/accounts/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/identity/accounts/writer-2.ts
      symbol: writer
---

Accounts writer of Accounts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [accounts-queue](accounts-queue.md) | Calls queue | HTTP |
| [accounts-worker](accounts-worker.md) | Reads worker | HTTP |
