---
type: C4 Component
title: Sessions worker
status: stable
groma:
  id: sessions-worker
  parent: sessions
  group: Support
  code:
    - scanner: typescript
      file: src/identity/sessions/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/sessions/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/sessions/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/sessions/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/sessions/worker-4.ts
      symbol: worker
---

Sessions worker of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-scheduler](sessions-scheduler.md) | Calls scheduler | HTTP |
| [sessions-metrics](sessions-metrics.md) | Reads metrics | HTTP |
