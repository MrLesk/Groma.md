---
type: C4 Component
title: Audit scheduler
status: stable
groma:
  id: audit-scheduler
  parent: audit
  code:
    - scanner: typescript
      file: src/identity/audit/scheduler.ts
      symbol: scheduler
---

Audit scheduler of Audit.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [audit-metrics](audit-metrics.md) | Calls metrics | HTTP |
| [audit-config](audit-config.md) | Reads config | HTTP |
