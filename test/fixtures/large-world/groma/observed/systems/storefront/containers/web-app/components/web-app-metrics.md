---
type: C4 Component
title: Web App metrics
status: stable
groma:
  id: web-app-metrics
  parent: web-app
  code:
    - scanner: typescript
      file: src/storefront/web-app/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/storefront/web-app/metrics-1.ts
      symbol: metrics
---

Web App metrics of Web App.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [web-app-config](web-app-config.md) | Calls config | HTTP |
| [web-app-logger](web-app-logger.md) | Reads logger | HTTP |
