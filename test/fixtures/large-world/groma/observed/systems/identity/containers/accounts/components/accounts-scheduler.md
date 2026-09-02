---
type: C4 Component
title: Accounts scheduler
status: stable
groma:
  id: accounts-scheduler
  parent: accounts
  code:
    - scanner: typescript
      file: src/identity/accounts/scheduler.ts
      symbol: scheduler
---

Accounts scheduler of Accounts.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [accounts-metrics](accounts-metrics.md) | Calls metrics | HTTP |
| [accounts-config](accounts-config.md) | Reads config | HTTP |
