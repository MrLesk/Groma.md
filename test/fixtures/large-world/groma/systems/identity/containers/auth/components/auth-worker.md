---
type: C4 Component
title: Auth worker
status: stable
groma:
  id: auth-worker
  parent: auth
  group: Support
  code:
    - scanner: typescript
      file: src/identity/auth/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/auth/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/auth/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/auth/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/auth/worker-4.ts
      symbol: worker
---

Auth worker of Auth.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [auth-scheduler](auth-scheduler.md) | Calls scheduler | HTTP |
| [auth-metrics](auth-metrics.md) | Reads metrics | HTTP |
