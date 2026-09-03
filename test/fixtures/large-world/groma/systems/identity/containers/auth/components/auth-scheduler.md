---
type: C4 Component
title: Auth scheduler
status: stable
groma:
  id: auth-scheduler
  parent: auth
  code:
    - scanner: typescript
      file: src/identity/auth/scheduler.ts
      symbol: scheduler
---

Auth scheduler of Auth.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [auth-metrics](auth-metrics.md) | Calls metrics | HTTP |
| [auth-config](auth-config.md) | Reads config | HTTP |
