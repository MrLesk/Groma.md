---
type: C4 Component
title: Session Store scheduler
status: stable
groma:
  id: session-store-scheduler
  parent: session-store
  code:
    - scanner: typescript
      file: src/storefront/session-store/scheduler.ts
      symbol: scheduler
---

Session Store scheduler of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [session-store-metrics](session-store-metrics.md) | Calls metrics | HTTP |
| [session-store-config](session-store-config.md) | Reads config | HTTP |
