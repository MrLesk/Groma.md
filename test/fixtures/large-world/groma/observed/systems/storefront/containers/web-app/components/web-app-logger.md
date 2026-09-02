---
type: C4 Component
title: Web App logger
status: stable
groma:
  id: web-app-logger
  parent: web-app
  code:
    - scanner: typescript
      file: src/storefront/web-app/logger.ts
      symbol: logger
    - scanner: typescript
      file: src/storefront/web-app/logger-1.ts
      symbol: logger
    - scanner: typescript
      file: src/storefront/web-app/logger-2.ts
      symbol: logger
    - scanner: typescript
      file: src/storefront/web-app/logger-3.ts
      symbol: logger
---

Web App logger of Web App.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [web-app-client](web-app-client.md) | Calls client | HTTP |
