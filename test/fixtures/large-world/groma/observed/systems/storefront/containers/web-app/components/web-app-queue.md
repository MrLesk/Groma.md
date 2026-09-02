---
type: C4 Component
title: Web App queue
status: stable
groma:
  id: web-app-queue
  parent: web-app
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/web-app/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/storefront/web-app/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/storefront/web-app/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/storefront/web-app/queue-3.ts
      symbol: queue
---

Web App queue of Web App.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [web-app-worker](web-app-worker.md) | Calls worker | HTTP |
| [web-app-scheduler](web-app-scheduler.md) | Reads scheduler | HTTP |
