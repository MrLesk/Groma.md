---
type: C4 Component
title: Audit queue
status: stable
groma:
  id: audit-queue
  parent: audit
  group: Support
  code:
    - scanner: typescript
      file: src/identity/audit/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/identity/audit/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/identity/audit/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/identity/audit/queue-3.ts
      symbol: queue
---

Audit queue of Audit.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [audit-worker](audit-worker.md) | Calls worker | HTTP |
| [audit-scheduler](audit-scheduler.md) | Reads scheduler | HTTP |
