---
type: C4 Component
title: Accounts queue
status: stable
groma:
  id: accounts-queue
  parent: accounts
  group: Support
  code:
    - scanner: typescript
      file: src/identity/accounts/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/identity/accounts/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/identity/accounts/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/identity/accounts/queue-3.ts
      symbol: queue
---

Accounts queue of Accounts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [accounts-worker](accounts-worker.md) | Calls worker | HTTP |
| [accounts-scheduler](accounts-scheduler.md) | Reads scheduler | HTTP |
