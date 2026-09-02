---
type: C4 Component
title: Sessions queue
status: stable
groma:
  id: sessions-queue
  parent: sessions
  group: Support
  code:
    - scanner: typescript
      file: src/identity/sessions/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/identity/sessions/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/identity/sessions/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/identity/sessions/queue-3.ts
      symbol: queue
---

Sessions queue of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-worker](sessions-worker.md) | Calls worker | HTTP |
| [sessions-scheduler](sessions-scheduler.md) | Reads scheduler | HTTP |
