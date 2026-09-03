---
type: C4 Component
title: Session Store metrics
status: stable
groma:
  id: session-store-metrics
  parent: session-store
  code:
    - scanner: typescript
      file: src/storefront/session-store/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/storefront/session-store/metrics-1.ts
      symbol: metrics
---

Session Store metrics of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [session-store-config](session-store-config.md) | Calls config | HTTP |
| [session-store-logger](session-store-logger.md) | Reads logger | HTTP |
