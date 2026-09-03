---
type: C4 Component
title: Web App config
status: stable
groma:
  id: web-app-config
  parent: web-app
  code:
    - scanner: typescript
      file: src/storefront/web-app/config.ts
      symbol: config
    - scanner: typescript
      file: src/storefront/web-app/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/storefront/web-app/config-2.ts
      symbol: config
---

Web App config of Web App.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [web-app-logger](web-app-logger.md) | Calls logger | HTTP |
| [web-app-client](web-app-client.md) | Reads client | HTTP |
