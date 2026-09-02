---
type: C4 Component
title: Web App session
status: stable
groma:
  id: web-app-session
  parent: web-app
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/web-app/session.ts
      symbol: session
    - scanner: typescript
      file: src/storefront/web-app/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/storefront/web-app/session-2.ts
      symbol: session
---

Web App session of Web App.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [web-app-cache](web-app-cache.md) | Calls cache | HTTP |
| [web-app-validator](web-app-validator.md) | Reads validator | HTTP |
