---
type: C4 Component
title: Sessions scheduler
status: stable
groma:
  id: sessions-scheduler
  parent: sessions
  code:
    - scanner: typescript
      file: src/identity/sessions/scheduler.ts
      symbol: scheduler
---

Sessions scheduler of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-metrics](sessions-metrics.md) | Calls metrics | HTTP |
| [sessions-config](sessions-config.md) | Reads config | HTTP |
