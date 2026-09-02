---
type: C4 Component
title: Sessions metrics
status: stable
groma:
  id: sessions-metrics
  parent: sessions
  code:
    - scanner: typescript
      file: src/identity/sessions/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/identity/sessions/metrics-1.ts
      symbol: metrics
---

Sessions metrics of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-config](sessions-config.md) | Calls config | HTTP |
| [sessions-logger](sessions-logger.md) | Reads logger | HTTP |
