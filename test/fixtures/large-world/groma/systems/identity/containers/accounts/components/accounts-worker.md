---
type: C4 Component
title: Accounts worker
status: stable
groma:
  id: accounts-worker
  parent: accounts
  group: Support
  code:
    - scanner: typescript
      file: src/identity/accounts/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/accounts/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/accounts/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/accounts/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/accounts/worker-4.ts
      symbol: worker
---

Accounts worker of Accounts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [accounts-scheduler](accounts-scheduler.md) | Calls scheduler | HTTP |
| [accounts-metrics](accounts-metrics.md) | Reads metrics | HTTP |
