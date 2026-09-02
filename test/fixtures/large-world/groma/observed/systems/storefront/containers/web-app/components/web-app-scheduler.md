---
type: C4 Component
title: Web App scheduler
status: stable
groma:
  id: web-app-scheduler
  parent: web-app
  code:
    - scanner: typescript
      file: src/storefront/web-app/scheduler.ts
      symbol: scheduler
---

Web App scheduler of Web App.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [web-app-metrics](web-app-metrics.md) | Calls metrics | HTTP |
| [web-app-config](web-app-config.md) | Reads config | HTTP |
