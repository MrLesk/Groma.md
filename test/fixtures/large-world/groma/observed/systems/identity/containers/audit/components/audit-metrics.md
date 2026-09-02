---
type: C4 Component
title: Audit metrics
status: stable
groma:
  id: audit-metrics
  parent: audit
  code:
    - scanner: typescript
      file: src/identity/audit/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/identity/audit/metrics-1.ts
      symbol: metrics
---

Audit metrics of Audit.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [audit-config](audit-config.md) | Calls config | HTTP |
| [audit-logger](audit-logger.md) | Reads logger | HTTP |
