---
type: C4 Component
title: Web App worker
status: stable
groma:
  id: web-app-worker
  parent: web-app
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/web-app/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/web-app/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/web-app/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/web-app/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/storefront/web-app/worker-4.ts
      symbol: worker
---

Web App worker of Web App.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [web-app-scheduler](web-app-scheduler.md) | Calls scheduler | HTTP |
| [web-app-metrics](web-app-metrics.md) | Reads metrics | HTTP |
