---
type: C4 Component
title: Audit worker
status: stable
groma:
  id: audit-worker
  parent: audit
  group: Support
  code:
    - scanner: typescript
      file: src/identity/audit/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/audit/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/audit/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/audit/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/identity/audit/worker-4.ts
      symbol: worker
---

Audit worker of Audit.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [audit-scheduler](audit-scheduler.md) | Calls scheduler | HTTP |
| [audit-metrics](audit-metrics.md) | Reads metrics | HTTP |
