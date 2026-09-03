---
type: C4 Component
title: Web App router
status: stable
groma:
  id: web-app-router
  parent: web-app
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/web-app/router.ts
      symbol: router
    - scanner: typescript
      file: src/storefront/web-app/router-1.ts
      symbol: router
---

Web App router of Web App.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [web-app-session](web-app-session.md) | Calls session | HTTP |
| [web-app-cache](web-app-cache.md) | Reads cache | HTTP |
